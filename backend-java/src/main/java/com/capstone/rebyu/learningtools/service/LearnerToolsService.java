package com.capstone.rebyu.learningtools.service;

import com.capstone.rebyu.certification.service.S3StorageService;
import com.capstone.rebyu.learningtools.repository.LearnerMistakeReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Personal learner library (saved quizzes/flashcards/files/links/notes, plus
 * saved community posts) and the mistakes bank (incorrect answers pulled from
 * finalized attempts). Backed by plain JDBC — these are read-heavy
 * projections over existing assessment/community tables, not owned entities.
 */
@Service
@RequiredArgsConstructor
public class LearnerToolsService {

    private static final List<String> ALLOWED_ITEM_TYPES =
            List.of("quiz", "flashcard", "file", "link", "note");

    private final JdbcTemplate jdbc;
    private final S3StorageService s3StorageService;
    private final LearnerMistakeReviewRepository mistakeReviewRepository;

    public record LibraryRequest(
            String itemType, String title, String description, String resourceUrl,
            Long certificationId, Long lessonId) {}

    /**
     * {@code lessonId} accompanies {@code lessonTitle} so the library can link
     * back to where an item came from. The title alone only ever let the page
     * *name* the lesson a generated quiz was built from; opening it needed the
     * id, and the row already carries one.
     */
    public record LibraryItem(
            Long id, String kind, String title, String description, String route,
            String downloadUrl, Long certificationId, String certificationTitle,
            Long lessonId, String lessonTitle, String details,
            OffsetDateTime createdAt, boolean ownedByMe) {}

    public record Mistake(
            Long mistakeId, Long questionId, String question, String questionType, String difficulty,
            String certificationTitle, String lessonTitle, String attemptSource, String learnerAnswer,
            String correctAnswer, String explanation, long mistakeCount, String masteryStatus,
            boolean reviewed, OffsetDateTime lastMistakeAt) {}

    // ------------------------------------------------------------------
    // Library
    // ------------------------------------------------------------------

    public List<LibraryItem> library(Long learnerId) {
        List<LibraryItem> items = new java.util.ArrayList<>(jdbc.query("""
                SELECT i.*, c.title certification_title, l.name lesson_title
                FROM learner_library_items i
                LEFT JOIN certifications c ON c.certification_id = i.certification_id
                LEFT JOIN lessons l ON l.lesson_id = i.lesson_id
                WHERE i.learner_id = ?
                ORDER BY i.created_at DESC
                """, this::mapLibraryItem, learnerId));

        items.addAll(jdbc.query("""
                SELECT p.post_id id, p.post_type kind, p.title, p.body description,
                       p.attachment_name, p.attachment_key, p.created_at, c.name circle_name
                FROM community_saved_posts s
                JOIN community_posts p ON p.post_id = s.post_id
                LEFT JOIN community_circles c ON c.circle_id = p.circle_id
                WHERE s.learner_id = ?
                ORDER BY s.created_at DESC
                """, this::mapSavedCommunityPost, learnerId));

        return items;
    }

    public LibraryItem createLibraryItem(Long learnerId, LibraryRequest request) {
        requireText(request.title(), "Title");
        String type = request.itemType() == null ? "link" : request.itemType().toLowerCase();
        if (!ALLOWED_ITEM_TYPES.contains(type)) {
            throw new IllegalArgumentException("Unsupported library item type: " + type);
        }
        if (List.of("link", "file").contains(type)) {
            requireText(request.resourceUrl(), "Resource URL");
        }

        Long id = jdbc.queryForObject("""
                INSERT INTO learner_library_items
                    (learner_id, certification_id, lesson_id, item_type, title, description, resource_url)
                VALUES (?,?,?,?,?,?,?)
                RETURNING library_item_id
                """, Long.class,
                learnerId, request.certificationId(), request.lessonId(), type,
                request.title().trim(), blankToNull(request.description()), blankToNull(request.resourceUrl()));

        return jdbc.queryForObject("""
                SELECT i.*, c.title certification_title, l.name lesson_title
                FROM learner_library_items i
                LEFT JOIN certifications c ON c.certification_id = i.certification_id
                LEFT JOIN lessons l ON l.lesson_id = i.lesson_id
                WHERE i.library_item_id = ?
                """, this::mapLibraryItem, id);
    }

    public void deleteLibraryItem(Long learnerId, Long id) {
        int deleted = jdbc.update(
                "DELETE FROM learner_library_items WHERE library_item_id = ? AND learner_id = ?", id, learnerId);
        if (deleted == 0) {
            throw new IllegalArgumentException("Library item not found or does not belong to you");
        }
    }

    /**
     * Uploads a real file for a "file"-type library item and returns its S3
     * key. The key is submitted back as {@code resourceUrl} on the create
     * call; {@link #mapLibraryItem} resolves it into a real download link.
     */
    public String uploadLibraryFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("A file is required");
        }
        try {
            return s3StorageService.uploadFile(file, "learner-library-files");
        } catch (IOException e) {
            throw new IllegalStateException("The file could not be uploaded", e);
        }
    }

    // ------------------------------------------------------------------
    // Mistakes bank
    // ------------------------------------------------------------------

    public List<Mistake> mistakes(Long learnerId) {
        return jdbc.query("""
                SELECT aq.source_question_id question_id, min(aq.attempt_question_id) mistake_id,
                  aq.question_text_snapshot question, aq.question_type,
                  coalesce(q.difficulty_level, 'AVERAGE') difficulty,
                  cert.title certification_title, l.name lesson_title, e.title attempt_source,
                  (array_agg(coalesce(ans.learner_answer, ans.submitted_code, selected.choice_text, 'No answer submitted')
                             ORDER BY a.submitted_at DESC))[1] learner_answer,
                  coalesce(tc.correct_answer, correct_choice.choice_text, 'Review the assessment explanation') correct_answer,
                  (array_agg(ans.feedback ORDER BY a.submitted_at DESC))[1] explanation,
                  count(*) mistake_count, max(a.submitted_at) last_mistake_at,
                  (mr.source_question_id IS NOT NULL) reviewed
                FROM assessment_attempt_answers ans
                JOIN assessment_attempt_questions aq ON aq.attempt_question_id = ans.attempt_question_id
                JOIN assessment_attempts a ON a.assessment_attempt_id = ans.assessment_attempt_id
                JOIN exams e ON e.exam_id = a.exam_id
                JOIN certifications cert ON cert.certification_id = e.certification_id
                LEFT JOIN questions q ON q.question_id = aq.source_question_id
                LEFT JOIN lessons l ON l.lesson_id = coalesce(aq.lesson_id, q.lesson_id)
                LEFT JOIN choices selected ON selected.choice_id = ans.selected_choice_id
                LEFT JOIN choices correct_choice
                    ON correct_choice.question_id = aq.source_question_id AND correct_choice.is_correct = true
                LEFT JOIN text_question_configs tc ON tc.question_id = aq.source_question_id
                LEFT JOIN learner_mistake_reviews mr
                    ON mr.learner_id = a.learner_id AND mr.source_question_id = aq.source_question_id
                WHERE a.learner_id = ? AND a.status = 'SUBMITTED' AND ans.is_correct = false
                GROUP BY aq.source_question_id, aq.question_text_snapshot, aq.question_type, q.difficulty_level,
                         cert.title, l.name, e.title, tc.correct_answer, correct_choice.choice_text, mr.source_question_id
                ORDER BY last_mistake_at DESC
                """, this::mapMistake, learnerId);
    }

    @Transactional
    public void markReviewed(Long learnerId, Long questionId, boolean reviewed) {
        if (reviewed) {
            mistakeReviewRepository.markReviewed(learnerId, questionId);
        } else {
            mistakeReviewRepository.deleteById_LearnerIdAndId_SourceQuestionId(learnerId, questionId);
        }
    }

    // ------------------------------------------------------------------
    // Mapping / helpers
    // ------------------------------------------------------------------

    /**
     * "file" items store a raw S3 key in {@code resourceUrl}/{@code route} —
     * NOT a ready-made link. The frontend already owns URL-building for S3
     * keys ({@code getFileViewUrl}/{@code getFileDownloadUrl} in
     * fileService.js) and knows the correct origin for the current
     * environment; duplicating that here would risk building a URL against
     * the wrong host in production. {@code downloadUrl} mirrors the same key
     * so the frontend doesn't need a kind-specific branch to find it.
     */
    private LibraryItem mapLibraryItem(ResultSet row, int rowNum) throws SQLException {
        String kind = row.getString("item_type");
        String resourceUrl = row.getString("resource_url");
        boolean isFile = "file".equals(kind);

        return new LibraryItem(
                row.getLong("library_item_id"),
                kind,
                row.getString("title"),
                row.getString("description"),
                resourceUrl,
                isFile ? resourceUrl : null,
                (Long) row.getObject("certification_id"),
                row.getString("certification_title"),
                (Long) row.getObject("lesson_id"),
                row.getString("lesson_title"),
                capitalize(kind),
                row.getObject("created_at", OffsetDateTime.class),
                true);
    }

    private LibraryItem mapSavedCommunityPost(ResultSet row, int rowNum) throws SQLException {
        String attachmentKey = row.getString("attachment_key");
        String attachmentName = row.getString("attachment_name");
        return new LibraryItem(
                row.getLong("id"),
                "community",
                row.getString("title"),
                row.getString("description"),
                "/learner/community",
                attachmentKey, // raw S3 key; frontend resolves via getFileViewUrl
                null,
                row.getString("circle_name"),
                null,
                null,
                attachmentName != null ? attachmentName : "Saved community post",
                row.getObject("created_at", OffsetDateTime.class),
                false);
    }

    private Mistake mapMistake(ResultSet row, int rowNum) throws SQLException {
        long count = row.getLong("mistake_count");
        return new Mistake(
                row.getLong("mistake_id"),
                row.getLong("question_id"),
                row.getString("question"),
                row.getString("question_type"),
                row.getString("difficulty"),
                row.getString("certification_title"),
                row.getString("lesson_title"),
                row.getString("attempt_source"),
                row.getString("learner_answer"),
                row.getString("correct_answer"),
                row.getString("explanation"),
                count,
                count >= 2 ? "weak" : "developing",
                row.getBoolean("reviewed"),
                row.getObject("last_mistake_at", OffsetDateTime.class));
    }

    private static String capitalize(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }
        return value.substring(0, 1).toUpperCase() + value.substring(1);
    }

    private static void requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " is required");
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}

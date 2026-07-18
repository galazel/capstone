package com.capstone.rebyu.learningtools;

import com.capstone.rebyu.bkt.config.BktProperties;
import com.capstone.rebyu.bkt.dto.BktMasteryEvent;
import com.capstone.rebyu.bkt.entity.BktEventOutbox;
import com.capstone.rebyu.bkt.entity.BktOutboxStatus;
import com.capstone.rebyu.bkt.repository.BktEventOutboxRepository;
import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.certification.entity.MiddleCategory;
import com.capstone.rebyu.learningtools.entity.GeneratedStudySet;
import com.capstone.rebyu.learningtools.entity.LearnerPracticeAnswer;
import com.capstone.rebyu.learningtools.repository.GeneratedStudySetRepository;
import com.capstone.rebyu.learningtools.repository.LearnerPracticeAnswerRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/** Converts only objective, lesson-linked quiz answers into the existing BKT outbox contract. */
@Service
@RequiredArgsConstructor
@Slf4j
public class PracticeMasteryEvidenceService {
    private final GeneratedStudySetRepository studySets;
    private final LearnerPracticeAnswerRepository answers;
    private final BktEventOutboxRepository outbox;
    private final ObjectMapper objectMapper;
    private final BktProperties properties;

    public boolean enqueueCompletedAttempt(Long learnerId, Long attemptId, String sourceType, Long sourceId) {
        if (!properties.isEnabled() || !("TUTOR_QUIZ".equals(sourceType) || "COMMUNITY_QUIZ".equals(sourceType))) return false;
        try {
            GeneratedStudySet set = studySets.findByIdWithCurriculum(sourceId).orElse(null);
            if (set == null) return false;
            Lesson lesson = set.getLesson();
            MiddleCategory middleCategory = lesson.getMiddleCategory();

            List<LearnerPracticeAnswer> mcqAnswers = answers.findMcqAnsweredByAttempt(attemptId);
            int inserted = 0;
            for (LearnerPracticeAnswer answer : mcqAnswers) {
                Long itemId = answer.getStudyItem().getStudyItemId();
                String eventId = "rebyu-practice:" + learnerId + ":" + sourceType + ":" + sourceId + ":" + itemId;
                if (outbox.existsByEventId(eventId)) continue;
                BktMasteryEvent event = new BktMasteryEvent(eventId, learnerId,
                        set.getCertification().getCertificationId(), middleCategory.getMajorCategory().getMajorCategoryId(),
                        middleCategory.getMiddleCategoryId(), lesson.getLessonId(), lesson.getName(),
                        middleCategory.getTitle(), middleCategory.getMajorCategory().getTitle(),
                        itemId, answer.getIsCorrect(), normalizeDifficulty(answer.getStudyItem().getDifficulty()),
                        "LESSON_QUIZ", LocalDateTime.now().toString());
                outbox.save(BktEventOutbox.builder().eventId(eventId).batchId("practice-" + attemptId)
                        .learnerId(learnerId).certificationId(set.getCertification().getCertificationId())
                        .examResultId(attemptId).attemptNo(1)
                        .eventType("MASTERY").payloadJson(objectMapper.writeValueAsString(event)).status(BktOutboxStatus.PENDING).build());
                inserted++;
            }
            return inserted > 0;
        } catch (Exception e) {
            log.warn("Could not enqueue BKT evidence for practice attempt {}: {}", attemptId, e.getMessage());
            return false;
        }
    }

    private static String normalizeDifficulty(String value) {
        if (value == null) return "AVERAGE";
        String normalized = value.trim().toUpperCase();
        return List.of("EASY", "AVERAGE", "HARD").contains(normalized) ? normalized : "AVERAGE";
    }
}

package com.capstone.rebyu.assessment.repository;

import com.capstone.rebyu.assessment.entity.Exam;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ExamRepository extends JpaRepository<Exam, Long> {
    List<Exam> findByCertification_CertificationId(Long certificationId);

    // Per-scope uniqueness checks (spec §5): one required assessment per scope.
    boolean existsByLesson_LessonId(Long lessonId);

    // Same check, but ignoring AI-tutor-generated practice quizzes: a learner
    // generating one for their own use must never block an admin from later
    // authoring the lesson's real, official quiz. Explicit JPQL rather than a
    // derived `...AndIsGeneratedFalse` name, since Spring Data's derivation
    // off a Lombok `is`-prefixed boolean getter is easy to get subtly wrong.
    @Query("SELECT COUNT(e) > 0 FROM Exam e WHERE e.lesson.lessonId = :lessonId AND e.isGenerated = false")
    boolean existsOfficialByLessonId(@Param("lessonId") Long lessonId);

    boolean existsByMiddleCategory_MiddleCategoryId(Long middleCategoryId);

    boolean existsByMajorCategory_MajorCategoryId(Long majorCategoryId);

    boolean existsByCertification_CertificationIdAndExamType_ExamTypeText(
            Long certificationId, String examTypeText);

    /**
     * Whether this certification has a PUBLISHED, official diagnostic.
     *
     * <p>The gate that asks this used to read every exam on the platform back
     * as entities and filter them in Java, on every assessment page load and
     * every attempt start. The predicate is three columns wide and belongs in
     * SQL: {@code ownerGroup IS NULL} is what "official" means (a group's own
     * assessment must never gate learners outside -- or inside -- that group),
     * and a null status is DRAFT, matching {@code Exam.effectiveStatus()}.
     */
    @Query("""
            SELECT COUNT(e) > 0 FROM Exam e
            WHERE e.certification.certificationId = :certificationId
              AND e.ownerGroup IS NULL
              AND e.examType.examTypeText = :examTypeText
              AND e.status = :status
            """)
    boolean existsOfficialPublishedByType(
            @Param("certificationId") Long certificationId,
            @Param("examTypeText") String examTypeText,
            @Param("status") Exam.Status status);

    /**
     * Whether this learner has a submitted attempt of an official exam of the
     * given type in this certification.
     *
     * <p>Answers the diagnostic gate's "has this learner actually sat it?" in
     * one round trip. Read as entities, the same question cost one query for
     * the attempt list and then one more per attempt to resolve the lazy exam
     * behind it just to read its type.
     */
    @Query("""
            SELECT COUNT(a) > 0 FROM AssessmentAttempt a
            WHERE a.learnerId = :learnerId
              AND a.exam.certification.certificationId = :certificationId
              AND a.status = :attemptStatus
              AND a.exam.ownerGroup IS NULL
              AND a.exam.examType.examTypeText = :examTypeText
            """)
    boolean existsSubmittedAttemptOfOfficialType(
            @Param("learnerId") Long learnerId,
            @Param("certificationId") Long certificationId,
            @Param("examTypeText") String examTypeText,
            @Param("attemptStatus") com.capstone.rebyu.assessment.entity.AssessmentAttempt.Status attemptStatus);

    /**
     * When this learner was last served an exam of a given type -- the pop-up
     * knowledge check's cooldown reads this so a learner cannot be interrupted
     * twice in the same sitting. The minted exam is itself the record that a
     * check was served, so no separate bookkeeping table is needed.
     */
    @Query("""
            SELECT MAX(e.publishedAt) FROM Exam e
            WHERE e.learner.learnerId = :learnerId
              AND e.examType.examTypeText = :examTypeText
            """)
    java.time.LocalDateTime findLastServedAt(
            @Param("learnerId") Long learnerId, @Param("examTypeText") String examTypeText);
}

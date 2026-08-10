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
}

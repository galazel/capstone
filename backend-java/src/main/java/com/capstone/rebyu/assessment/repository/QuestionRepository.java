package com.capstone.rebyu.assessment.repository;

import com.capstone.rebyu.assessment.entity.Question;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface QuestionRepository extends JpaRepository<Question, Long> {
    List<Question> findByLesson_LessonId(Long lessonId);

    List<Question> findByParentQuestion_QuestionId(Long questionId);

    // Stable authoring order for sub-questions (creation order); used
    // wherever critical-thinking sub-questions must render/grade as an
    // ordered list rather than in arbitrary fetch order.
    List<Question> findByParentQuestion_QuestionIdOrderByQuestionIdAsc(Long questionId);

    // Scope-derived eligibility (top-level questions only; sub-questions ride
    // with their parent). Ordered for stable picker display.
    List<Question> findByParentQuestionIsNullAndLesson_LessonIdOrderByQuestionIdAsc(Long lessonId);

    List<Question> findByParentQuestionIsNullAndLesson_MiddleCategory_MiddleCategoryIdOrderByQuestionIdAsc(
            Long middleCategoryId);

    List<Question> findByParentQuestionIsNullAndLesson_MiddleCategory_MajorCategory_MajorCategoryIdOrderByQuestionIdAsc(
            Long majorCategoryId);

    List<Question> findByParentQuestionIsNullAndLesson_MiddleCategory_MajorCategory_Certification_CertificationIdOrderByQuestionIdAsc(
            Long certificationId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM Question q WHERE q.questionId = :id")
    void deleteByQuestionId(@Param("id") Long id);

    @Query("SELECT q FROM Question q WHERE q.lesson.lessonId = :lessonId AND q.questionText = :questionText AND q.questionType = :questionType AND q.parentQuestion IS NULL LIMIT 1")
    Optional<Question> findDuplicate(@Param("lessonId") Long lessonId, @Param("questionText") String questionText, @Param("questionType") String questionType);
}

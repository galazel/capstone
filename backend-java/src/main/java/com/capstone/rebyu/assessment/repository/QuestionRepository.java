package com.capstone.rebyu.assessment.repository;

import com.capstone.rebyu.assessment.entity.Question;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
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

    // ------------------------------------------------------------------
    // Selection projections
    // ------------------------------------------------------------------
    // Same four scopes as above, as flat projections. See QuestionSelectionView
    // for why loading these as entities costs 1 + 3N queries instead of 1.
    // ownerGroup is LEFT JOINed: official questions have none, and an inner
    // join would silently drop every one of them from the candidate pool.

    @Query("""
            SELECT q.questionId AS questionId, l.lessonId AS lessonId,
                   q.difficultyLevel AS difficultyLevel, q.questionText AS questionText,
                   og.institutionGroupId AS ownerGroupId
            FROM Question q JOIN q.lesson l LEFT JOIN q.ownerGroup og
            WHERE q.parentQuestion IS NULL AND l.lessonId = :lessonId
            ORDER BY q.questionId ASC
            """)
    List<QuestionSelectionView> findSelectionViewsByLesson(@Param("lessonId") Long lessonId);

    @Query("""
            SELECT q.questionId AS questionId, l.lessonId AS lessonId,
                   q.difficultyLevel AS difficultyLevel, q.questionText AS questionText,
                   og.institutionGroupId AS ownerGroupId
            FROM Question q JOIN q.lesson l LEFT JOIN q.ownerGroup og
            WHERE q.parentQuestion IS NULL AND l.middleCategory.middleCategoryId = :middleCategoryId
            ORDER BY q.questionId ASC
            """)
    List<QuestionSelectionView> findSelectionViewsByMiddleCategory(
            @Param("middleCategoryId") Long middleCategoryId);

    @Query("""
            SELECT q.questionId AS questionId, l.lessonId AS lessonId,
                   q.difficultyLevel AS difficultyLevel, q.questionText AS questionText,
                   og.institutionGroupId AS ownerGroupId
            FROM Question q JOIN q.lesson l LEFT JOIN q.ownerGroup og
            WHERE q.parentQuestion IS NULL
              AND l.middleCategory.majorCategory.majorCategoryId = :majorCategoryId
            ORDER BY q.questionId ASC
            """)
    List<QuestionSelectionView> findSelectionViewsByMajorCategory(
            @Param("majorCategoryId") Long majorCategoryId);

    @Query("""
            SELECT q.questionId AS questionId, l.lessonId AS lessonId,
                   q.difficultyLevel AS difficultyLevel, q.questionText AS questionText,
                   og.institutionGroupId AS ownerGroupId
            FROM Question q JOIN q.lesson l LEFT JOIN q.ownerGroup og
            WHERE q.parentQuestion IS NULL
              AND l.middleCategory.majorCategory.certification.certificationId = :certificationId
            ORDER BY q.questionId ASC
            """)
    List<QuestionSelectionView> findSelectionViewsByCertification(
            @Param("certificationId") Long certificationId);

    @Query("""
            SELECT q.questionId AS questionId, l.lessonId AS lessonId,
                   q.difficultyLevel AS difficultyLevel, q.questionText AS questionText,
                   og.institutionGroupId AS ownerGroupId
            FROM Question q JOIN q.lesson l LEFT JOIN q.ownerGroup og
            WHERE q.questionId IN :ids
            """)
    List<QuestionSelectionView> findSelectionViewsByIdIn(@Param("ids") Collection<Long> ids);

    /**
     * Loads whole questions with everything an attempt snapshot reads, in one
     * query. The three configs are named explicitly because they are EAGER
     * either way -- naming them turns three SELECTs per question into three
     * joins on the one query. Only ever call this for a paper's worth of ids.
     */
    @EntityGraph(attributePaths = {
            "choices", "diagramQuestionConfig", "programmingQuestionConfig", "textQuestionConfig"})
    @Query("SELECT DISTINCT q FROM Question q WHERE q.questionId IN :ids")
    List<Question> findForAttemptByIdIn(@Param("ids") Collection<Long> ids);

    /**
     * One certification's whole question bank, in one query.
     *
     * <p>The question bank page used to read every question on the platform as
     * entities and narrow them in the browser. Mapping a Question to its DTO
     * touches five associations that are not loaded with it -- choices,
     * createdBy (dereferenced for the author's email, so the proxy has to be
     * resolved), and the three configs that are EAGER whether anyone wants them
     * or not -- which is five SELECTs per question, for every question that
     * exists, to draw one certification's library.
     *
     * <p>The graph turns all five into joins on this query, the same trick
     * {@link #findForAttemptByIdIn} uses and for the same reason. choices is
     * the only collection among them, so there is no cartesian product to pay
     * for; testCases under programmingQuestionConfig stays lazy and unread.
     *
     * <p>Sub-questions are included, as they were in the unfiltered read this
     * replaces -- the bank lists them.
     */
    @EntityGraph(attributePaths = {
            "choices", "createdBy", "ownerGroup",
            "diagramQuestionConfig", "programmingQuestionConfig", "textQuestionConfig"})
    @Query("""
            SELECT DISTINCT q FROM Question q
            WHERE q.lesson.middleCategory.majorCategory.certification.certificationId = :certificationId
            """)
    List<Question> findBankByCertificationId(@Param("certificationId") Long certificationId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM Question q WHERE q.questionId = :id")
    void deleteByQuestionId(@Param("id") Long id);

    @Query("SELECT q FROM Question q WHERE q.lesson.lessonId = :lessonId AND q.questionText = :questionText AND q.questionType = :questionType AND q.parentQuestion IS NULL LIMIT 1")
    Optional<Question> findDuplicate(@Param("lessonId") Long lessonId, @Param("questionText") String questionText, @Param("questionType") String questionType);
}

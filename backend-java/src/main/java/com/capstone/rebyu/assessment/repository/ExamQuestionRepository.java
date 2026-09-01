package com.capstone.rebyu.assessment.repository;

import com.capstone.rebyu.assessment.entity.ExamQuestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface ExamQuestionRepository extends JpaRepository<ExamQuestion, Long> {
    boolean existsByQuestion_QuestionId(Long questionId);

    List<ExamQuestion> findByExam_ExamIdOrderByDisplayOrderAsc(Long examId);

    long countByExam_ExamId(Long examId);

    @Modifying
    void deleteByExam_ExamId(Long examId);

    /**
     * Every listed exam's question ids in a single query, in display order.
     *
     * <p>The list endpoint used to call {@link #findByExam_ExamIdOrderByDisplayOrderAsc}
     * once per exam to fill in each DTO's questionIds -- one query per row, on
     * the response the admin certification page waits for before it can draw a
     * single assessment. Selecting the two ids directly also keeps the read off
     * the Question entity, so no question row is loaded just to read its key.
     */
    @Query("""
            SELECT eq.exam.examId AS examId, eq.question.questionId AS questionId
            FROM ExamQuestion eq
            WHERE eq.exam.examId IN :examIds
            ORDER BY eq.exam.examId ASC, eq.displayOrder ASC
            """)
    List<ExamQuestionIdView> findQuestionIdsByExamIds(@Param("examIds") Collection<Long> examIds);

    /** Projection for {@link #findQuestionIdsByExamIds}. */
    interface ExamQuestionIdView {
        Long getExamId();

        Long getQuestionId();
    }
}

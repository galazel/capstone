package com.capstone.rebyu.assessment.repository;

import com.capstone.rebyu.assessment.entity.QuestionRubricCriterion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;

import java.util.List;

public interface QuestionRubricCriterionRepository
        extends JpaRepository<QuestionRubricCriterion, Long> {

    List<QuestionRubricCriterion> findByQuestion_QuestionIdOrderByDisplayOrderAsc(Long questionId);

    /**
     * Rubric criteria for MANY questions at once -- the batched form of the
     * method above, for callers snapshotting or reviewing a whole paper. Asking
     * per question is one round trip per item to find that most items have no
     * rubric at all.
     */
    List<QuestionRubricCriterion> findByQuestion_QuestionIdInOrderByQuestion_QuestionIdAscDisplayOrderAsc(
            Collection<Long> questionIds);
}

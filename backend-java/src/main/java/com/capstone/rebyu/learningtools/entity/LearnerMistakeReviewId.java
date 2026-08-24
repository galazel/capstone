package com.capstone.rebyu.learningtools.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.io.Serial;
import java.io.Serializable;

/** (learner_id, source_question_id) composite key for the mistakes bank. */
@Embeddable
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = false)
public class LearnerMistakeReviewId implements Serializable {

    @Column(name = "learner_id", nullable = false)
    private Long learnerId;

    @Column(name = "source_question_id", nullable = false)
    private Long sourceQuestionId;

    @Serial
    private static final long serialVersionUID = 1L;
}

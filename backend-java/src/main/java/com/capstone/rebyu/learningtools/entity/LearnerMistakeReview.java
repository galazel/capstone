package com.capstone.rebyu.learningtools.entity;

import com.capstone.rebyu.assessment.entity.Question;
import com.capstone.rebyu.user.entity.Learner;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * One row per mistake a learner has ticked off as reviewed.
 *
 * <p>The mistakes list itself stays a native projection over the attempt
 * tables ({@code LearnerToolsService.mistakes}); this entity exists so the
 * table it LEFT JOINs is actually part of the mapped model. It previously was
 * not, which meant nothing ever created it — see V25.
 */
@Entity
@Table(name = "learner_mistake_reviews")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LearnerMistakeReview {

    @EmbeddedId
    private LearnerMistakeReviewId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("learnerId")
    @JoinColumn(name = "learner_id")
    private Learner learner;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("sourceQuestionId")
    @JoinColumn(name = "source_question_id")
    private Question sourceQuestion;

    @Column(name = "reviewed_at", nullable = false)
    @Builder.Default
    private OffsetDateTime reviewedAt = OffsetDateTime.now();
}

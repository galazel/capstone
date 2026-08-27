package com.capstone.rebyu.learningtools.entity;

import com.capstone.rebyu.assessment.entity.Question;
import com.capstone.rebyu.user.entity.Learner;
import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * One thing the learner is keeping in memory, and when it next needs testing.
 *
 * <p>The scheduling state behind spaced repetition, held per learner per
 * question. REBYU had none of this: {@code LearnerMistakeReview} is a "I ticked
 * this off" marker with a timestamp and nothing else, and the flashcard
 * self-rating ({@code AGAIN|HARD|GOOD|EASY}) was stored but never read by
 * anything — an SM-2 grade with no SM-2 behind it. This is that missing half.
 *
 * <h3>The fields are SM-2's</h3>
 * <ul>
 *   <li>{@code easeFactor} — how well this item sticks for this learner.
 *       Starts at 2.5 and drifts with performance, floored at 1.3 because
 *       below that the interval stops growing and the item is simply shown
 *       forever.</li>
 *   <li>{@code repetitions} — consecutive successful recalls. Reset to zero by
 *       a lapse, which is what pulls a forgotten item back to the front.</li>
 *   <li>{@code intervalDays} — the gap that produced {@code dueOn}, kept
 *       because the next interval is computed from the last one.</li>
 *   <li>{@code lapses} — how often this was forgotten after being learned.
 *       Not used by the schedule; kept because "which material keeps
 *       collapsing" is a different and more useful question than "what is due".</li>
 * </ul>
 *
 * <p>{@code dueOn} is a date, not an instant: review is a thing you do today or
 * do not, and an item becoming due at 14:23 because that is when it was graded
 * six days ago would be false precision.
 */
@Data
@Entity
@Table(
    name = "learner_review_items",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_learner_review_item",
        columnNames = {"learner_id", "source_question_id"}),
    indexes = @Index(name = "ix_learner_review_due", columnList = "learner_id, due_on"))
public class LearnerReviewItem {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long reviewItemId;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "learner_id", nullable = false)
  private Learner learner;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "source_question_id", nullable = false)
  private Question sourceQuestion;

  /**
   * Denormalised from the question's lesson so a session can be narrowed to the
   * topic the study plan scheduled without joining up the curriculum tree on
   * every due-items read.
   */
  @Column(name = "lesson_id")
  private Long lessonId;

  /** Denormalised for the same reason: sessions are scoped per certification. */
  @Column(name = "certification_id")
  private Long certificationId;

  @Column(nullable = false)
  private int repetitions;

  @Column(nullable = false)
  private int intervalDays;

  @Column(nullable = false)
  private double easeFactor;

  @Column(name = "due_on", nullable = false)
  private LocalDate dueOn;

  @Column(nullable = false)
  private int lapses;

  private LocalDateTime lastReviewedAt;
  private LocalDateTime createdAt;
  private LocalDateTime updatedAt;
}

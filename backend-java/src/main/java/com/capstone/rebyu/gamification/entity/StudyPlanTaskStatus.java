package com.capstone.rebyu.gamification.entity;

import com.capstone.rebyu.user.entity.Learner;
import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * What has become of one scheduled task on a study plan.
 *
 * <p>A row per event the learner has actually engaged with, rather than one per
 * event in the plan: a plan runs to dozens of sessions and the overwhelming
 * majority are untouched, so "no row" is the pending state and nothing is
 * written until something happens.
 *
 * <p>Kept as its own table rather than as a field inside the plan's schedule
 * JSON. The schedule is stored as one opaque blob, so recording a status there
 * means read-modify-write over the whole plan -- two tabs finishing two sessions
 * at once would have one silently overwrite the other, and the blob is also what
 * the generator overwrites wholesale when a plan is regenerated. Status is
 * per-event, written far more often than the plan itself, and outlives a
 * regeneration only if it is kept apart from it.
 *
 * <p>{@code eventId} is the generator's own event id ("event-7", "catch-up-…"),
 * which is unique within a plan but not across plans -- hence the pairing with
 * the plan in the unique constraint.
 */
@Data
@Entity
@Table(
    name = "study_plan_task_status",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_study_plan_task_plan_event",
        columnNames = {"plan_id", "event_id"}))
public class StudyPlanTaskStatus {

  /** Nothing has happened yet. Never stored -- it is the absence of a row. */
  public static final String PENDING = "PENDING";

  /** The activity has been launched and not yet finished. */
  public static final String IN_PROGRESS = "IN_PROGRESS";

  public static final String COMPLETED = "COMPLETED";

  /** Deliberately passed over, so the scheduler stops offering it. */
  public static final String SKIPPED = "SKIPPED";

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long taskStatusId;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "plan_id")
  private StudyPlan plan;

  /**
   * Denormalised from the plan so a learner's own rows can be read and
   * ownership checked without loading every plan they have.
   */
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "learner_id")
  private Learner learner;

  @Column(name = "event_id", nullable = false)
  private String eventId;

  @Column(nullable = false)
  private String status;

  private LocalDateTime startedAt;
  private LocalDateTime completedAt;
  private LocalDateTime updatedAt;
}

package com.capstone.rebyu.learningtools.entity;

import com.capstone.rebyu.user.entity.Learner;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * A learner's own study note -- a checklist line on the analytics page, kept
 * per certification so the list is about whatever they are currently studying.
 *
 * Stored server-side rather than in the browser: a revision checklist that
 * disappears when the learner opens REBYU on their phone, or clears their
 * browser data, is worse than no checklist at all, because they will have
 * trusted it.
 */
@Entity
@Table(name = "learner_notes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LearnerNote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "note_id")
    private Long noteId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "learner_id", nullable = false)
    private Learner learner;

    /** The certification the note belongs to. Notes are scoped to one course. */
    @Column(name = "certification_id", nullable = false)
    private Long certificationId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    @Column(nullable = false)
    @Builder.Default
    private boolean done = false;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;
}

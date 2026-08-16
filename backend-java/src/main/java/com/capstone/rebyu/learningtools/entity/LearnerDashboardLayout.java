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
 * The order a learner has dragged their analytics tiles into.
 *
 * One row per learner, not per certification: the arrangement is a preference
 * about how they read the page, and having it change under them when they
 * switch certification would read as the page rearranging itself.
 *
 * Stored as the tile ids in order, JSON, rather than as coordinates -- the grid
 * keeps deciding each tile's size and how the whole thing collapses on a phone,
 * so all that has to persist is the sequence.
 */
@Entity
@Table(
        name = "learner_dashboard_layouts",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_dashboard_layout_learner", columnNames = "learner_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LearnerDashboardLayout {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "layout_id")
    private Long layoutId;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "learner_id", nullable = false, unique = true)
    private Learner learner;

    /** JSON array of tile ids, in the order they should be rendered. */
    @Column(name = "tile_order", nullable = false, columnDefinition = "TEXT")
    private String tileOrder;

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private OffsetDateTime updatedAt = OffsetDateTime.now();
}

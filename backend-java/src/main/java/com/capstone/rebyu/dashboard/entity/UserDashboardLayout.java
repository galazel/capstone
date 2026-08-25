package com.capstone.rebyu.dashboard.entity;

import com.capstone.rebyu.user.entity.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * How one person has arranged one dashboard.
 *
 * Keyed on the user rather than the learner, which is what makes it usable by the
 * admin and institution boards -- neither of those audiences has a learner row, so
 * {@code LearnerDashboardLayout} is structurally unavailable to them.
 *
 * The UNIQUE(user_id, board) is declared here as well as in V60. It has to be:
 * `ddl-auto: update` never adds a constraint that only exists in a migration, so
 * an entity that stays silent about it leaves environments built by Hibernate
 * without the guarantee the code depends on.
 */
@Entity
@Table(
        name = "user_dashboard_layouts",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_user_dashboard_layout_user_board",
                columnNames = {"user_id", "board"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserDashboardLayout {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "layout_id")
    private Long layoutId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Which board this arrangement belongs to -- see {@code DashboardBoard}. */
    @Column(name = "board", nullable = false, length = 40)
    private String board;

    /** JSON array of {id, x, y, w, h} placements. */
    @Column(name = "tile_order", nullable = false, columnDefinition = "TEXT")
    private String tileOrder;

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private OffsetDateTime updatedAt = OffsetDateTime.now();
}

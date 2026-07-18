package com.capstone.rebyu.community.entity;

import com.capstone.rebyu.user.entity.Learner;
import com.capstone.rebyu.user.entity.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

@Entity
@Table(name = "community_post_reports")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CommunityPostReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "report_id")
    private Long reportId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "post_id", nullable = false)
    private CommunityPost post;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reporter_learner_id", nullable = false)
    private Learner reporter;

    /** SPAM | HARASSMENT | COPYRIGHT | EXAM_CONTENT | OTHER (see V32 CHECK constraint). */
    @Column(nullable = false, length = 48)
    private String reason;

    @Column(columnDefinition = "TEXT")
    private String details;

    /** OPEN | RESOLVED | DISMISSED (see V32 CHECK constraint). */
    @Column(nullable = false, length = 16)
    @Builder.Default
    private String status = "OPEN";

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "reviewed_at")
    private OffsetDateTime reviewedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by_user_id")
    private User reviewedBy;
}

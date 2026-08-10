package com.capstone.rebyu.community.entity;

import com.capstone.rebyu.learningtools.entity.LearnerLibraryItem;
import com.capstone.rebyu.user.entity.Learner;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

@Entity
@Table(name = "community_posts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CommunityPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "post_id")
    private Long postId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_learner_id", nullable = false)
    private Learner author;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "circle_id")
    private CommunityCircle circle;

    /** discussion | quizzes | notes | docx | circle (see V24 CHECK constraint). */
    @Column(name = "post_type", nullable = false, length = 24)
    private String postType;

    @Column(nullable = false, length = 180)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    @Column(name = "attachment_name", length = 255)
    private String attachmentName;

    @Column(name = "attachment_type", length = 16)
    private String attachmentType;

    /** S3 key of a real uploaded PDF/DOCX; null when the post has no attachment. */
    @Column(name = "attachment_key", length = 500)
    private String attachmentKey;

    /** Byte size of the uploaded reviewer, for the feed's "PDF · 1.2 MB" label (V57). */
    @Column(name = "attachment_size")
    private Long attachmentSize;

    /** Set when this post shares a generated quiz/flashcard set (V29). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shared_library_item_id")
    private LearnerLibraryItem sharedLibraryItem;

    /** VISIBLE | HIDDEN (see V33 CHECK constraint). */
    @Column(name = "moderation_status", nullable = false, length = 16)
    @Builder.Default
    private String moderationStatus = "VISIBLE";

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private OffsetDateTime updatedAt = OffsetDateTime.now();
}

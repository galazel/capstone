package com.capstone.rebyu.community;

import com.capstone.rebyu.certification.service.S3StorageService;
import com.capstone.rebyu.community.entity.CommunityCircle;
import com.capstone.rebyu.community.entity.CommunityCircleMember;
import com.capstone.rebyu.community.entity.CommunityCircleMemberId;
import com.capstone.rebyu.community.entity.CommunityComment;
import com.capstone.rebyu.community.entity.CommunityPost;
import com.capstone.rebyu.community.entity.CommunityPostLike;
import com.capstone.rebyu.community.entity.CommunityPostMemberId;
import com.capstone.rebyu.community.entity.CommunityPostReport;
import com.capstone.rebyu.community.entity.CommunitySavedPost;
import com.capstone.rebyu.community.entity.LearnerCommunityNotification;
import com.capstone.rebyu.community.repository.CommunityCircleMemberRepository;
import com.capstone.rebyu.community.repository.CommunityCircleRepository;
import com.capstone.rebyu.community.repository.CommunityCircleRow;
import com.capstone.rebyu.community.repository.CommunityCommentRepository;
import com.capstone.rebyu.community.repository.CommunityPostLikeRepository;
import com.capstone.rebyu.community.repository.CommunityPostReportRepository;
import com.capstone.rebyu.community.repository.CommunityPostRepository;
import com.capstone.rebyu.community.repository.CommunityPostRow;
import com.capstone.rebyu.community.repository.CommunitySavedPostRepository;
import com.capstone.rebyu.community.repository.LearnerCommunityNotificationRepository;
import com.capstone.rebyu.learningtools.entity.LearnerLibraryItem;
import com.capstone.rebyu.learningtools.repository.LearnerLibraryItemRepository;
import com.capstone.rebyu.user.entity.Learner;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Learner community: discussion/resource posts, study circles, likes, saves,
 * and comments. Backed by JPA entities/repositories over the {@code community_*}
 * tables (V24/V25/V27/V29/V32-V34).
 */
@Service
@RequiredArgsConstructor
public class CommunityService {

    private static final List<String> ALLOWED_POST_TYPES =
            List.of("discussion", "quiz", "flashcard", "quizzes", "notes", "docx");

    private final CommunityPostRepository postRepository;
    private final CommunityCircleRepository circleRepository;
    private final CommunityCircleMemberRepository circleMemberRepository;
    private final CommunityCommentRepository commentRepository;
    private final CommunityPostLikeRepository postLikeRepository;
    private final CommunitySavedPostRepository savedPostRepository;
    private final CommunityPostReportRepository reportRepository;
    private final LearnerCommunityNotificationRepository notificationRepository;
    private final LearnerLibraryItemRepository libraryItemRepository;
    private final S3StorageService s3StorageService;

    public record PostRequest(
            String postType, String title, String description, Long circleId,
            String attachmentName, String attachmentType, String attachmentKey) {}

    public record CircleRequest(String name, String description, String topic) {}

    public record CommentRequest(String body, Long parentCommentId) {}
    public record ShareStudyItemRequest(Long circleId) {}
    public record ReportRequest(String reason, String details) {}
    public record ReportView(Long reportId, Long postId, String postTitle, String authorName, String reporterName,
                             String reason, String details, String status, OffsetDateTime createdAt) {}
    public record LearnerNotification(Long id, String title, String description, OffsetDateTime createdAt, String href) {}

    public record Post(
            Long postId, String authorName, String initials, String community, OffsetDateTime createdAt,
            String title, String description, String postType, Long circleId,
            String attachmentName, String attachmentType, String attachmentKey,
            long reactions, long comments, boolean liked, boolean saved, boolean ownedByMe) {}

    public record Circle(
            Long circleId, String initials, String name, String description, String topic,
            long members, boolean joined, boolean owner) {}

    public record Comment(
            Long commentId, Long postId, Long parentCommentId, String authorName,
            String initials, String body, OffsetDateTime createdAt, boolean ownedByMe) {}

    // ------------------------------------------------------------------
    // Posts
    // ------------------------------------------------------------------

    public List<Post> posts(Long learnerId, String type, String search, boolean savedOnly) {
        String normalizedType = normalizeFilter(type, "for-you");
        String normalizedSearch = normalizeFilter(search, null);
        String searchPattern = normalizedSearch == null ? null : "%" + normalizedSearch.toLowerCase() + "%";
        return postRepository.feed(learnerId, normalizedType, searchPattern, savedOnly).stream()
                .map(CommunityService::mapPostRow)
                .toList();
    }

    private Post postById(Long learnerId, Long postId) {
        return postRepository.findRowById(postId, learnerId)
                .map(CommunityService::mapPostRow)
                .filter(p -> "VISIBLE".equals(p.postType()) || "VISIBLE".equals(getPostStatus(postId)))
                .orElseThrow(() -> new EntityNotFoundException("Post not found: " + postId));
    }

    private void requirePostVisible(Long postId) {
        CommunityPost post = postRepository.findById(postId)
                .orElseThrow(() -> new EntityNotFoundException("Post not found: " + postId));
        if (!"VISIBLE".equals(post.getModerationStatus())) {
            throw new EntityNotFoundException("This post is not available");
        }
    }

    private String getPostStatus(Long postId) {
        return postRepository.findById(postId)
                .map(CommunityPost::getModerationStatus)
                .orElse("HIDDEN");
    }

    @Transactional
    public Post createPost(Long learnerId, PostRequest request) {
        requireText(request.title(), "Title");
        requireText(request.description(), "Description");

        String type = request.postType() == null ? "discussion" : request.postType();
        if (!ALLOWED_POST_TYPES.contains(type)) {
            throw new IllegalArgumentException("Unsupported post type: " + type);
        }
        if (request.circleId() != null) {
            requireCircleMember(learnerId, request.circleId());
        }

        CommunityCircle circle = request.circleId() == null ? null : circleRef(request.circleId());
        CommunityPost post = CommunityPost.builder()
                .author(Learner.builder().learnerId(learnerId).build())
                .circle(circle)
                .postType(type)
                .title(request.title().trim())
                .body(request.description().trim())
                .attachmentName(blankToNull(request.attachmentName()))
                .attachmentType(blankToNull(request.attachmentType()))
                .attachmentKey(blankToNull(request.attachmentKey()))
                .build();
        CommunityPost saved = postRepository.save(post);
        return postById(learnerId, saved.getPostId());
    }

    @Transactional
    public Post shareStudyItem(Long learnerId, Long libraryItemId, Long circleId) {
        if (circleId != null) requireCircleMember(learnerId, circleId);
        LearnerLibraryItem item = libraryItemRepository.findByLibraryItemIdAndLearner_LearnerId(libraryItemId, learnerId)
                .filter(i -> List.of("quiz", "flashcard").contains(i.getItemType()))
                .orElseThrow(() -> new IllegalArgumentException("Generated quiz or flashcards not found"));
        CommunityCircle circle = circleId == null ? null : circleRef(circleId);
        CommunityPost post = CommunityPost.builder()
                .author(Learner.builder().learnerId(learnerId).build())
                .circle(circle)
                .postType(item.getItemType())
                .title(item.getTitle())
                .body(item.getDescription())
                .sharedLibraryItem(item)
                .build();
        CommunityPost saved = postRepository.save(post);
        return postById(learnerId, saved.getPostId());
    }

    /** Resolves a post's structured study set without disclosing it directly to the client. */
    public Long sharedStudySetId(Long postId) {
        CommunityPost post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("This post does not contain an answerable study set"));
        // Must match the moderation_status='VISIBLE' guard in posts() -- a hidden post (e.g.
        // flagged for leaked exam content or copyright) must stop being copyable into new
        // learners' study sets, not just stop appearing in the feed.
        if (!"VISIBLE".equals(post.getModerationStatus())
                || !List.of("quiz", "flashcard").contains(post.getPostType())
                || post.getSharedLibraryItem() == null) {
            throw new IllegalArgumentException("This post does not contain an answerable study set");
        }
        String route = post.getSharedLibraryItem().getResourceUrl();
        String prefix = "/learner/practice/";
        if (route == null || !route.startsWith(prefix)) throw new IllegalArgumentException("This older study post cannot be practised yet");
        try { return Long.valueOf(route.substring(prefix.length())); }
        catch (NumberFormatException ex) { throw new IllegalArgumentException("Shared study set is invalid"); }
    }

    @Transactional
    public Post updatePost(Long learnerId, Long postId, PostRequest request) {
        CommunityPost post = postRepository.findById(postId)
                .orElseThrow(() -> new EntityNotFoundException("Post not found"));
        if (!post.getAuthor().getLearnerId().equals(learnerId)) {
            throw new IllegalArgumentException("You can only edit your own post");
        }
        post.setTitle(request.title());
        post.setDescription(request.description());
        postRepository.save(post);
        return toPost(learnerId, post);
    }

    public void deletePost(Long learnerId, Long postId) {
        long deleted = postRepository.deleteByPostIdAndAuthor_LearnerId(postId, learnerId);
        if (deleted == 0) {
            throw new IllegalArgumentException("You can only delete your own post");
        }
    }

    @Transactional
    public void reportPost(Long learnerId, Long postId, ReportRequest request) {
        if (request == null || request.reason() == null || !List.of("SPAM", "HARASSMENT", "COPYRIGHT", "EXAM_CONTENT", "OTHER").contains(request.reason())) {
            throw new IllegalArgumentException("Choose a valid report reason");
        }
        if (!postRepository.existsById(postId)) throw new EntityNotFoundException("Post not found");
        reportRepository.upsertReport(postId, learnerId, request.reason(), blankToNull(request.details()));
    }

    public List<ReportView> reports(String status) {
        String normalized = status == null || status.isBlank() ? "OPEN" : status.toUpperCase();
        if (!List.of("OPEN", "RESOLVED", "DISMISSED").contains(normalized)) throw new IllegalArgumentException("Invalid report status");
        return reportRepository.findByStatusOrderByCreatedAtAsc(normalized).stream()
                .map(r -> new ReportView(r.getReportId(), r.getPost().getPostId(), r.getPost().getTitle(),
                        fullName(r.getPost().getAuthor()), fullName(r.getReporter()), r.getReason(), r.getDetails(),
                        r.getStatus(), r.getCreatedAt()))
                .toList();
    }

    @Transactional
    public void reviewReport(Long reportId, String status, Long adminUserId) {
        String normalized = status == null ? "" : status.toUpperCase();
        if (!List.of("RESOLVED", "DISMISSED").contains(normalized)) throw new IllegalArgumentException("Report status must be RESOLVED or DISMISSED");
        CommunityPostReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> new EntityNotFoundException("Report not found"));
        report.setStatus(normalized);
        report.setReviewedAt(OffsetDateTime.now());
        report.setReviewedBy(adminUserId == null ? null : com.capstone.rebyu.user.entity.User.builder().userId(adminUserId).build());
        reportRepository.save(report);
    }

    @Transactional
    public void hidePost(Long postId) {
        CommunityPost post = postRepository.findById(postId)
                .orElseThrow(() -> new EntityNotFoundException("Post not found"));
        post.setModerationStatus("HIDDEN");
        postRepository.save(post);
        notificationRepository.save(LearnerCommunityNotification.builder()
                .learner(post.getAuthor())
                .title("Your community post was hidden")
                .body("Your post '" + post.getTitle() + "' was hidden after a moderation review.")
                .href("/learner/community")
                .build());
    }

    public List<LearnerNotification> notifications(Long learnerId) {
        return notificationRepository.findTop20ByLearner_LearnerIdOrderByCreatedAtDesc(learnerId).stream()
                .map(n -> new LearnerNotification(n.getNotificationId(), n.getTitle(), n.getBody(), n.getCreatedAt(), n.getHref()))
                .toList();
    }

    /** Uploads a PDF/DOCX attachment and returns its key. Call before {@link #createPost}. */
    public String uploadAttachment(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("A file is required");
        }
        try {
            return s3StorageService.uploadFile(file, "community-attachments");
        } catch (IOException e) {
            throw new IllegalStateException("The attachment could not be uploaded", e);
        }
    }

    // ------------------------------------------------------------------
    // Likes / saves
    // ------------------------------------------------------------------

    public boolean toggleLike(Long learnerId, Long postId) {
        requirePostVisible(postId);
        if (postLikeRepository.existsByPost_PostIdAndLearner_LearnerId(postId, learnerId)) {
            postLikeRepository.deleteByPost_PostIdAndLearner_LearnerId(postId, learnerId);
            return false;
        }
        postLikeRepository.save(CommunityPostLike.builder()
                .id(new CommunityPostMemberId(postId, learnerId))
                .post(postRef(postId)).learner(Learner.builder().learnerId(learnerId).build())
                .build());
        return true;
    }

    public boolean toggleSave(Long learnerId, Long postId) {
        requirePostVisible(postId);
        if (savedPostRepository.existsByPost_PostIdAndLearner_LearnerId(postId, learnerId)) {
            savedPostRepository.deleteByPost_PostIdAndLearner_LearnerId(postId, learnerId);
            return false;
        }
        savedPostRepository.save(CommunitySavedPost.builder()
                .id(new CommunityPostMemberId(postId, learnerId))
                .post(postRef(postId)).learner(Learner.builder().learnerId(learnerId).build())
                .build());
        return true;
    }

    // ------------------------------------------------------------------
    // Comments
    // ------------------------------------------------------------------

    public List<Comment> comments(Long learnerId, Long postId) {
        requirePostVisible(postId);
        return commentRepository.findByPost_PostIdOrderByCreatedAtAsc(postId).stream()
                .map(c -> mapComment(c, learnerId))
                .toList();
    }

    public Comment addComment(Long learnerId, Long postId, CommentRequest request) {
        requirePostVisible(postId);
        requireText(request.body(), "Comment");
        CommunityComment parent = request.parentCommentId() == null ? null : commentRef(request.parentCommentId());
        CommunityComment comment = CommunityComment.builder()
                .post(postRef(postId))
                .author(Learner.builder().learnerId(learnerId).build())
                .parentComment(parent)
                .body(request.body().trim())
                .build();
        return mapComment(commentRepository.save(comment), learnerId);
    }

    // ------------------------------------------------------------------
    // Circles
    // ------------------------------------------------------------------

    public List<Circle> circles(Long learnerId) {
        return circleRepository.feed(learnerId).stream().map(CommunityService::mapCircleRow).toList();
    }

    private Circle circleById(Long learnerId, Long circleId) {
        return circleRepository.findRowById(circleId, learnerId)
                .map(CommunityService::mapCircleRow)
                .orElseThrow(() -> new EntityNotFoundException("Study circle not found: " + circleId));
    }

    @Transactional
    public Circle createCircle(Long learnerId, CircleRequest request) {
        requireText(request.name(), "Circle name");
        requireText(request.description(), "Description");
        requireText(request.topic(), "Topic");

        CommunityCircle circle = CommunityCircle.builder()
                .owner(Learner.builder().learnerId(learnerId).build())
                .name(request.name().trim())
                .description(request.description().trim())
                .topic(request.topic().trim())
                .build();
        CommunityCircle saved = circleRepository.save(circle);

        circleMemberRepository.save(CommunityCircleMember.builder()
                .id(new CommunityCircleMemberId(saved.getCircleId(), learnerId))
                .circle(saved).learner(Learner.builder().learnerId(learnerId).build())
                .build());

        postRepository.save(CommunityPost.builder()
                .author(Learner.builder().learnerId(learnerId).build())
                .circle(saved)
                .postType("circle")
                .title(request.name().trim() + " is now open")
                .body(request.description().trim())
                .build());

        return circleById(learnerId, saved.getCircleId());
    }

    /** Owners are always members and cannot leave their own circle. Returns the joined state. */
    @Transactional
    public boolean toggleJoin(Long learnerId, Long circleId) {
        CommunityCircle circle = circleRepository.findById(circleId)
                .orElseThrow(() -> new EntityNotFoundException("Study circle not found: " + circleId));
        if (circle.getOwner().getLearnerId().equals(learnerId)) {
            return true;
        }
        if (circleMemberRepository.existsByCircle_CircleIdAndLearner_LearnerId(circleId, learnerId)) {
            circleMemberRepository.deleteById(new CommunityCircleMemberId(circleId, learnerId));
            return false;
        }
        circleMemberRepository.save(CommunityCircleMember.builder()
                .id(new CommunityCircleMemberId(circleId, learnerId))
                .circle(circle).learner(Learner.builder().learnerId(learnerId).build())
                .build());
        return true;
    }

    private void requireCircleMember(Long learnerId, Long circleId) {
        if (!circleMemberRepository.existsByCircle_CircleIdAndLearner_LearnerId(circleId, learnerId)) {
            throw new IllegalArgumentException("Join the study circle before posting");
        }
    }

    // ------------------------------------------------------------------
    // Mapping / helpers
    // ------------------------------------------------------------------

    private static Post mapPostRow(CommunityPostRow row) {
        return new Post(row.getPostId(), row.getAuthorName(), initials(row.getAuthorName()), row.getCommunity(),
                row.getCreatedAt(), row.getTitle(), row.getBody(), row.getPostType(), row.getCircleId(),
                row.getAttachmentName(), row.getAttachmentType(), row.getAttachmentKey(), row.getReactions(),
                row.getComments(), row.getLiked(), row.getSaved(), row.getOwnedByMe());
    }

    private static Circle mapCircleRow(CommunityCircleRow row) {
        return new Circle(row.getCircleId(), initials(row.getName()), row.getName(), row.getDescription(),
                row.getTopic(), row.getMembers(), row.getJoined(), row.getOwner());
    }

    private Comment mapComment(CommunityComment comment, Long viewerLearnerId) {
        String authorName = fullName(comment.getAuthor());
        return new Comment(comment.getCommentId(), comment.getPost().getPostId(),
                comment.getParentComment() == null ? null : comment.getParentComment().getCommentId(),
                authorName, initials(authorName), comment.getBody(), comment.getCreatedAt(),
                viewerLearnerId.equals(comment.getAuthor().getLearnerId()));
    }

    private static String fullName(Learner learner) {
        return (learner.getFirstName() == null ? "" : learner.getFirstName())
                + " " + (learner.getLastName() == null ? "" : learner.getLastName());
    }

    private CommunityPost postRef(Long postId) {
        CommunityPost ref = new CommunityPost();
        ref.setPostId(postId);
        return ref;
    }

    private CommunityCircle circleRef(Long circleId) {
        CommunityCircle ref = new CommunityCircle();
        ref.setCircleId(circleId);
        return ref;
    }

    private CommunityComment commentRef(Long commentId) {
        CommunityComment ref = new CommunityComment();
        ref.setCommentId(commentId);
        return ref;
    }

    /** "for-you" is the client's "no filter" tab; treat it (and blank) as no type filter. */
    private static String normalizeFilter(String value, String noiseValue) {
        if (value == null || value.isBlank() || value.equals(noiseValue)) {
            return null;
        }
        return value.trim();
    }

    private static void requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " is required");
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /** First letter of up to two whitespace-separated name tokens, uppercased. Safe on blank tokens. */
    private static String initials(String name) {
        if (name == null || name.isBlank()) {
            return "?";
        }
        String[] parts = name.trim().split("\\s+");
        StringBuilder result = new StringBuilder();
        for (String part : parts) {
            if (!part.isEmpty()) {
                result.append(Character.toUpperCase(part.charAt(0)));
            }
            if (result.length() >= 2) {
                break;
            }
        }
        return result.isEmpty() ? "?" : result.toString();
    }
}

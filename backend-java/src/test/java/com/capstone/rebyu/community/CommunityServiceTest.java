package com.capstone.rebyu.community;

import com.capstone.rebyu.certification.service.S3StorageService;
import com.capstone.rebyu.community.entity.CommunityPost;
import com.capstone.rebyu.community.repository.CommunityCircleMemberRepository;
import com.capstone.rebyu.community.repository.CommunityCircleRepository;
import com.capstone.rebyu.community.repository.CommunityCommentRepository;
import com.capstone.rebyu.community.repository.CommunityPostLikeRepository;
import com.capstone.rebyu.community.repository.CommunityPostReportRepository;
import com.capstone.rebyu.community.repository.CommunityPostRepository;
import com.capstone.rebyu.community.repository.CommunitySavedPostRepository;
import com.capstone.rebyu.community.repository.LearnerCommunityNotificationRepository;
import com.capstone.rebyu.learningtools.entity.LearnerLibraryItem;
import com.capstone.rebyu.learningtools.repository.LearnerLibraryItemRepository;
import com.capstone.rebyu.user.entity.Learner;
import com.capstone.rebyu.user.repository.LearnerRepository;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CommunityServiceTest {

    private static final Long LEARNER_ID = 1L;
    private static final Long POST_ID = 20L;

    private CommunityPostRepository postRepository;
    private CommunityCircleRepository circleRepository;
    private CommunityCircleMemberRepository circleMemberRepository;
    private CommunityCommentRepository commentRepository;
    private CommunityPostLikeRepository postLikeRepository;
    private CommunitySavedPostRepository savedPostRepository;
    private CommunityPostReportRepository reportRepository;
    private LearnerCommunityNotificationRepository notificationRepository;
    private LearnerLibraryItemRepository libraryItemRepository;
    private LearnerRepository learnerRepository;
    private S3StorageService s3StorageService;
    private CommunityService service;

    @BeforeEach
    void setUp() {
        postRepository = mock(CommunityPostRepository.class);
        circleRepository = mock(CommunityCircleRepository.class);
        circleMemberRepository = mock(CommunityCircleMemberRepository.class);
        commentRepository = mock(CommunityCommentRepository.class);
        postLikeRepository = mock(CommunityPostLikeRepository.class);
        savedPostRepository = mock(CommunitySavedPostRepository.class);
        reportRepository = mock(CommunityPostReportRepository.class);
        notificationRepository = mock(LearnerCommunityNotificationRepository.class);
        libraryItemRepository = mock(LearnerLibraryItemRepository.class);
        learnerRepository = mock(LearnerRepository.class);
        s3StorageService = mock(S3StorageService.class);
        service = new CommunityService(postRepository, circleRepository, circleMemberRepository, commentRepository,
                postLikeRepository, savedPostRepository, reportRepository, notificationRepository,
                libraryItemRepository, learnerRepository, s3StorageService);

        when(postRepository.save(any(CommunityPost.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private CommunityPost sharedQuizPost(String moderationStatus) {
        LearnerLibraryItem item = LearnerLibraryItem.builder()
                .libraryItemId(5L)
                .itemType("quiz")
                .title("Algebra basics")
                .resourceUrl("/learner/practice/77")
                .build();
        CommunityPost post = CommunityPost.builder()
                .postId(POST_ID)
                .author(Learner.builder().learnerId(LEARNER_ID).firstName("Ana").lastName("Cruz").build())
                .postType("quiz")
                .title("Algebra basics")
                .body("Shared quiz")
                .sharedLibraryItem(item)
                .build();
        post.setModerationStatus(moderationStatus);
        return post;
    }

    private CommunityPost visiblePost() {
        return sharedQuizPost("VISIBLE");
    }

    // ---- hidePost ----

    @Test
    void hidePost_setsModerationStatusAndNotifiesAuthor() {
        CommunityPost post = sharedQuizPost("VISIBLE");
        when(postRepository.findById(POST_ID)).thenReturn(Optional.of(post));

        service.hidePost(POST_ID);

        assertEquals("HIDDEN", post.getModerationStatus());
        verify(postRepository).save(post);
        verify(notificationRepository).save(argThat(n ->
                n.getLearner().getLearnerId().equals(LEARNER_ID)
                        && n.getBody().contains("Algebra basics")));
    }

    @Test
    void hidePost_postNotFound_throws() {
        when(postRepository.findById(POST_ID)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> service.hidePost(POST_ID));
    }

    // ---- sharedStudySetId: the moderation bypass this session fixed ----

    @Test
    void sharedStudySetId_hiddenPost_throwsInsteadOfReturningStudySet() {
        when(postRepository.findById(POST_ID)).thenReturn(Optional.of(sharedQuizPost("HIDDEN")));

        assertThrows(IllegalArgumentException.class, () -> service.sharedStudySetId(POST_ID));
    }

    @Test
    void sharedStudySetId_visiblePost_returnsParsedStudySetId() {
        when(postRepository.findById(POST_ID)).thenReturn(Optional.of(sharedQuizPost("VISIBLE")));

        Long studySetId = service.sharedStudySetId(POST_ID);

        assertEquals(77L, studySetId);
    }

    @Test
    void sharedStudySetId_discussionPost_throws() {
        CommunityPost post = sharedQuizPost("VISIBLE");
        post.setPostType("discussion");
        post.setSharedLibraryItem(null);
        when(postRepository.findById(POST_ID)).thenReturn(Optional.of(post));

        assertThrows(IllegalArgumentException.class, () -> service.sharedStudySetId(POST_ID));
    }

    // ---- like/save toggle ----

    @Test
    void toggleLike_notPreviouslyLiked_addsLikeAndReturnsTrue() {
        when(postRepository.findById(POST_ID)).thenReturn(Optional.of(visiblePost()));
        when(postLikeRepository.existsByPost_PostIdAndLearner_LearnerId(POST_ID, LEARNER_ID)).thenReturn(false);
        when(postLikeRepository.countByPost_PostId(POST_ID)).thenReturn(4L);

        CommunityService.PostCounts result = service.toggleLike(LEARNER_ID, POST_ID);

        assertTrue(result.active());
        assertEquals(4L, result.reactions());
        verify(postLikeRepository).addLike(POST_ID, LEARNER_ID);
        verify(postLikeRepository, never()).deleteByPost_PostIdAndLearner_LearnerId(any(), any());
    }

    @Test
    void toggleLike_previouslyLiked_removesLikeAndReturnsFalse() {
        when(postRepository.findById(POST_ID)).thenReturn(Optional.of(visiblePost()));
        when(postLikeRepository.existsByPost_PostIdAndLearner_LearnerId(POST_ID, LEARNER_ID)).thenReturn(true);

        CommunityService.PostCounts result = service.toggleLike(LEARNER_ID, POST_ID);

        assertFalse(result.active());
        verify(postLikeRepository).deleteByPost_PostIdAndLearner_LearnerId(POST_ID, LEARNER_ID);
        verify(postLikeRepository, never()).addLike(any(), any());
    }

    // ---- deletePost / reportPost guards ----

    @Test
    void deletePost_notOwner_throws() {
        when(postRepository.deleteByPostIdAndAuthor_LearnerId(POST_ID, LEARNER_ID)).thenReturn(0L);

        assertThrows(IllegalArgumentException.class, () -> service.deletePost(LEARNER_ID, POST_ID));
    }

    @Test
    void reportPost_invalidReason_throws() {
        assertThrows(IllegalArgumentException.class,
                () -> service.reportPost(LEARNER_ID, POST_ID, new CommunityService.ReportRequest("NOT_A_REASON", null)));
        verify(reportRepository, times(0)).upsertReport(any(), any(), any(), any());
    }

    @Test
    void reportPost_postDoesNotExist_throws() {
        when(postRepository.existsById(POST_ID)).thenReturn(false);

        assertThrows(EntityNotFoundException.class,
                () -> service.reportPost(LEARNER_ID, POST_ID, new CommunityService.ReportRequest("SPAM", null)));
    }
}

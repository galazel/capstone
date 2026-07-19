package com.capstone.rebyu.community;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.learningtools.StudyPracticeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/community")
@RequiredArgsConstructor
public class CommunityController {

    private final CommunityService service;
    private final CognitoAuthService auth;
    private final StudyPracticeService practiceService;

    @GetMapping("/posts")
    public List<CommunityService.Post> posts(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "false") boolean saved) {
        return service.posts(me(jwt), type, search, saved);
    }

    @PostMapping("/posts")
    @ResponseStatus(HttpStatus.CREATED)
    public CommunityService.Post createPost(
            @AuthenticationPrincipal Jwt jwt, @RequestBody CommunityService.PostRequest request) {
        return service.createPost(me(jwt), request);
    }

    @GetMapping("/notifications")
    public List<CommunityService.LearnerNotification> notifications(@AuthenticationPrincipal Jwt jwt) { return service.notifications(me(jwt)); }

    @PutMapping("/notifications/{notificationId}/read")
    public void markNotificationRead(@AuthenticationPrincipal Jwt jwt, @PathVariable Long notificationId) {
        service.markNotificationRead(me(jwt), notificationId);
    }

    @PostMapping("/posts/shared-study-item/{libraryItemId}")
    @ResponseStatus(HttpStatus.CREATED)
    public CommunityService.Post shareStudyItem(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long libraryItemId,
            @RequestBody CommunityService.ShareStudyItemRequest request) {
        return service.shareStudyItem(me(jwt), libraryItemId, request.circleId());
    }

    @PostMapping("/posts/{postId}/practice")
    public StudyPracticeService.Attempt startSharedPractice(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId) {
        return practiceService.startCommunityAttempt(me(jwt), service.sharedStudySetId(postId));
    }

    @PostMapping("/posts/{postId}/report")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reportPost(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId, @RequestBody CommunityService.ReportRequest request) {
        service.reportPost(me(jwt), postId, request);
    }

    /** Upload a PDF/DOCX before creating a post; the returned key is passed as attachmentKey. */
    @PostMapping(value = "/posts/attachment", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, String> uploadAttachment(
            @AuthenticationPrincipal Jwt jwt, @RequestParam("file") MultipartFile file) {
        me(jwt); // require an authenticated learner even though the upload itself is stateless
        return Map.of("attachmentKey", service.uploadAttachment(file));
    }

    @PutMapping("/posts/{id}")
    public CommunityService.Post updatePost(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @RequestBody CommunityService.PostRequest request) {
        return service.updatePost(me(jwt), id, request);
    }

    @DeleteMapping("/posts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePost(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        service.deletePost(me(jwt), id);
    }

    @PostMapping("/posts/{id}/like")
    public Map<String, Boolean> like(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return Map.of("active", service.toggleLike(me(jwt), id));
    }

    @PostMapping("/posts/{id}/save")
    public Map<String, Boolean> save(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return Map.of("active", service.toggleSave(me(jwt), id));
    }

    @GetMapping("/posts/{id}/comments")
    public List<CommunityService.Comment> comments(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return service.comments(me(jwt), id);
    }

    @PostMapping("/posts/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public CommunityService.Comment comment(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @RequestBody CommunityService.CommentRequest request) {
        return service.addComment(me(jwt), id, request);
    }

    @GetMapping("/circles")
    public List<CommunityService.Circle> circles(@AuthenticationPrincipal Jwt jwt) {
        return service.circles(me(jwt));
    }

    @PostMapping("/circles")
    @ResponseStatus(HttpStatus.CREATED)
    public CommunityService.Circle createCircle(
            @AuthenticationPrincipal Jwt jwt, @RequestBody CommunityService.CircleRequest request) {
        return service.createCircle(me(jwt), request);
    }

    @PostMapping("/circles/{id}/membership")
    public Map<String, Boolean> membership(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return Map.of("joined", service.toggleJoin(me(jwt), id));
    }

    private Long me(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (user.learnerId() == null) {
            throw new IllegalArgumentException("A learner account is required");
        }
        return user.learnerId();
    }
}

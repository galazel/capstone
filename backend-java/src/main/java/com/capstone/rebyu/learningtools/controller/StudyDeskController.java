package com.capstone.rebyu.learningtools.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.learningtools.service.StudyDeskService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * The signed-in learner's study notes, scoped to one certification. The learner
 * is always resolved from the validated token, never from the request, so one
 * learner can neither read nor edit another's notes.
 */
@RestController
@RequestMapping("/api/study-desk")
@RequiredArgsConstructor
public class StudyDeskController {

    private final StudyDeskService studyDeskService;
    private final CognitoAuthService auth;

    public record NoteRequest(String body, Boolean done) {}
    public record LayoutRequest(List<StudyDeskService.TilePlacement> tiles) {}

    @GetMapping("/notes")
    public List<StudyDeskService.NoteDto> notes(
            @AuthenticationPrincipal Jwt jwt, @RequestParam Long certificationId) {
        return studyDeskService.notes(me(jwt), certificationId);
    }

    @PostMapping("/notes")
    @ResponseStatus(HttpStatus.CREATED)
    public StudyDeskService.NoteDto addNote(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam Long certificationId,
            @RequestBody NoteRequest request) {
        return studyDeskService.addNote(me(jwt), certificationId, request.body());
    }

    /** Tick/untick, or edit the text. Omitted fields are left alone. */
    @PatchMapping("/notes/{noteId}")
    public StudyDeskService.NoteDto updateNote(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long noteId,
            @RequestBody NoteRequest request) {
        return studyDeskService.updateNote(me(jwt), noteId, request.done(), request.body());
    }

    @DeleteMapping("/notes/{noteId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteNote(@AuthenticationPrincipal Jwt jwt, @PathVariable Long noteId) {
        studyDeskService.deleteNote(me(jwt), noteId);
    }

    /** Clear all of this certification's notes, or only the ticked ones. */
    @DeleteMapping("/notes")
    public Map<String, Integer> clearNotes(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam Long certificationId,
            @RequestParam(defaultValue = "false") boolean completedOnly) {
        return Map.of("deleted", studyDeskService.clearNotes(me(jwt), certificationId, completedOnly));
    }

    /** The learner's analytics board. Empty means "use the page defaults". */
    @GetMapping("/dashboard-layout")
    public Map<String, List<StudyDeskService.TilePlacement>> dashboardLayout(
            @AuthenticationPrincipal Jwt jwt) {
        return Map.of("tiles", studyDeskService.dashboardLayout(me(jwt)));
    }

    @PutMapping("/dashboard-layout")
    public Map<String, List<StudyDeskService.TilePlacement>> saveDashboardLayout(
            @AuthenticationPrincipal Jwt jwt, @RequestBody LayoutRequest request) {
        return Map.of("tiles", studyDeskService.saveDashboardLayout(me(jwt), request.tiles()));
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

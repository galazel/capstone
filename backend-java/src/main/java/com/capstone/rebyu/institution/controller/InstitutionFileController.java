package com.capstone.rebyu.institution.controller;

import com.capstone.rebyu.institution.service.InstitutionFileService;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;
import java.util.Map;

@RestController @RequestMapping("/api/institution/files") @RequiredArgsConstructor
public class InstitutionFileController {
    private final InstitutionFileService files; private final CognitoAuthService auth;
    @GetMapping public List<InstitutionFileService.FileView> list(@AuthenticationPrincipal Jwt jwt) { return files.list(me(jwt).institutionId()); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public InstitutionFileService.FileView upload(@AuthenticationPrincipal Jwt jwt, @RequestParam("file") MultipartFile file) { CurrentUserDto user=me(jwt); return files.upload(user.institutionId(), user.userId(), file); }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) { files.delete(me(jwt).institutionId(), id); }
    /** Short-lived presigned download URL, scoped to the caller's own institution (404 otherwise). */
    @GetMapping("/{id}/download-url") public Map<String, String> downloadUrl(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) { return Map.of("url", files.downloadUrl(me(jwt).institutionId(), id)); }
    private CurrentUserDto me(Jwt jwt) { if(jwt==null) throw new IllegalArgumentException("Authentication is required"); CurrentUserDto user=auth.syncCurrentUser(jwt,jwt.getTokenValue()); if(user.institutionId()==null) throw new IllegalArgumentException("Institution access is required"); return user; }
}

package com.capstone.rebyu.enterprise.controller;

import com.capstone.rebyu.enterprise.service.EnterpriseFileService;

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

@RestController @RequestMapping("/api/enterprise/files") @RequiredArgsConstructor
public class EnterpriseFileController {
    private final EnterpriseFileService files; private final CognitoAuthService auth;
    @GetMapping public List<EnterpriseFileService.FileView> list(@AuthenticationPrincipal Jwt jwt) { return files.list(me(jwt).enterpriseId()); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public EnterpriseFileService.FileView upload(@AuthenticationPrincipal Jwt jwt, @RequestParam("file") MultipartFile file) { CurrentUserDto user=me(jwt); return files.upload(user.enterpriseId(), user.userId(), file); }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) { files.delete(me(jwt).enterpriseId(), id); }
    /** Short-lived presigned download URL, scoped to the caller's own enterprise (404 otherwise). */
    @GetMapping("/{id}/download-url") public Map<String, String> downloadUrl(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) { return Map.of("url", files.downloadUrl(me(jwt).enterpriseId(), id)); }
    private CurrentUserDto me(Jwt jwt) { if(jwt==null) throw new IllegalArgumentException("Authentication is required"); CurrentUserDto user=auth.syncCurrentUser(jwt,jwt.getTokenValue()); if(user.enterpriseId()==null) throw new IllegalArgumentException("Enterprise access is required"); return user; }
}

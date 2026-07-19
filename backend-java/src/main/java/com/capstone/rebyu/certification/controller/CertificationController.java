package com.capstone.rebyu.certification.controller;

import com.capstone.rebyu.ai.service.CurriculumGenerationService;
import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.certification.dto.CertificationDto;
import com.capstone.rebyu.certification.service.CertificationService;
import com.capstone.rebyu.enterprisegroup.service.EnterpriseGroupService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

/**
 * Reads stay public -- the certification catalog is browsed from the public
 * partnership-request page before an organization even has an account, and by
 * every signed-in role. WRITES had no authentication at all (anyone could
 * create/edit/delete/publish any certification); now admin-only.
 *
 * includeGroupId is the opt-in mechanism that lets a group's own curriculum
 * view mix in that group's Enterprise-Member-authored content: omitted (the
 * default, and the only thing every existing caller does), the response is
 * identical to before this parameter existed -- official content only, since
 * no content has ever had a non-null owner group. Passed, it additionally
 * requires the caller to actually be able to act on that group (owner or its
 * active leader), so a caller can't read a group's private content by
 * guessing its id.
 */
@RestController
@RequestMapping("/api/certifications")
@RequiredArgsConstructor
@Slf4j
public class CertificationController {

    private final CertificationService certificationService;
    private final CurriculumGenerationService curriculumGenerationService;
    private final EnterpriseGroupService enterpriseGroupService;
    private final CognitoAuthService auth;

    @GetMapping
    public List<CertificationDto> getAll(
            @AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) Long includeGroupId) {
        requireGroupAccessIfRequested(jwt, includeGroupId);
        return certificationService.getAll(includeGroupId);
    }

    @GetMapping("/{id}")
    public CertificationDto getById(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id,
            @RequestParam(required = false) Long includeGroupId) {
        requireGroupAccessIfRequested(jwt, includeGroupId);
        return certificationService.getById(id, includeGroupId);
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public CertificationDto create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CertificationDto dto) {
        requireAdmin(jwt);
        return certificationService.create(dto);
    }


    @PostMapping(value = "/generate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public CertificationDto createWithAi(
            @AuthenticationPrincipal Jwt jwt,
            @RequestPart("data") @Valid CertificationDto dto,
            @RequestPart(value = "files", required = false) List<MultipartFile> files,
            @RequestParam(value = "additionalInstructions", required = false) String additionalInstructions
    ) throws IOException {
        requireAdmin(jwt);
        log.info("AI certification creation requested for '{}'", dto.getTitle());
        return curriculumGenerationService.generateForNewCertification(
                dto, files, additionalInstructions
        );
    }

    @PutMapping("/{id}")
    public CertificationDto update(
            @AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @Valid @RequestBody CertificationDto dto) {
        requireAdmin(jwt);
        return certificationService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        requireAdmin(jwt);
        certificationService.delete(id);
        log.info("Deleted certification with ID: {}", id);
    }

    @GetMapping("/{id}/publishing-requirements")
    public com.capstone.rebyu.certification.dto.CertificationPublishRequirementsDto publishingRequirements(
            @PathVariable Long id) {
        return certificationService.getPublishingRequirements(id);
    }

    @PutMapping("/publish/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void publishCertification(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        requireAdmin(jwt);
        certificationService.publish(id);
        log.info("Publish certification with ID: {}", id);
    }

    private void requireAdmin(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (!"ADMIN".equalsIgnoreCase(user.role())) {
            throw new IllegalArgumentException("Admin access is required");
        }
    }

    /**
     * No-op when includeGroupId is omitted -- the request stays fully public,
     * exactly as before this parameter existed. When supplied, the caller must
     * be authenticated and able to act on that specific group (the institution
     * owner, or that group's active leader) -- reusing the same access check
     * EnterpriseGroupController already relies on -- so group-owned content
     * can't be read by guessing a group id.
     */
    private void requireGroupAccessIfRequested(Jwt jwt, Long includeGroupId) {
        if (includeGroupId == null) {
            return;
        }
        if (jwt == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (user.enterpriseId() == null) {
            throw new IllegalArgumentException("An enterprise account is required");
        }
        boolean owner = "owner".equalsIgnoreCase(user.enterpriseMemberRole());
        // Throws EntityNotFoundException (-> 404/400 via the global handler) if
        // the caller can't actually act on this group.
        enterpriseGroupService.getAccessibleById(includeGroupId, user.enterpriseId(), user.userId(), owner);
    }
}

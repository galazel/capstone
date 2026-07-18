package com.capstone.rebyu.certification.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.certification.dto.CertificationDto;
import com.capstone.rebyu.certification.dto.FileDto;
import com.capstone.rebyu.certification.service.LessonImageService;
import com.capstone.rebyu.certification.service.LessonVideoService;
import com.capstone.rebyu.certification.service.S3StorageService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.net.URLConnection;
import java.util.Locale;

@RestController
@RequestMapping("/api/files")
@CrossOrigin(origins = "http://localhost:5173")
@Slf4j
public class FileController {

    private final S3StorageService s3StorageService;
    private final LessonImageService lessonImageService;
    private final LessonVideoService lessonVideoService;
    private final CognitoAuthService auth;

    public FileController(
            S3StorageService s3StorageService,
            LessonImageService lessonImageService,
            LessonVideoService lessonVideoService,
            CognitoAuthService auth
    ) {
        this.s3StorageService = s3StorageService;
        this.lessonImageService = lessonImageService;
        this.lessonVideoService = lessonVideoService;
        this.auth = auth;
    }

    @PostMapping(
            value = "/upload",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
            produces = MediaType.TEXT_PLAIN_VALUE
    )
    public ResponseEntity<String> upload(
            @ModelAttribute FileDto fileDto,
            @AuthenticationPrincipal Jwt jwt
    ) throws Exception {
        requireAdmin(jwt);
        validateLessonMediaUpload(fileDto);

        String key = s3StorageService.uploadFile(fileDto);

        saveLessonMediaReference(fileDto, key);

        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_PLAIN)
                .body(key);
    }

    @PostMapping(
            value = "/upload/certification",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
            produces = MediaType.TEXT_PLAIN_VALUE
    )
    public ResponseEntity<String> uploadCertification(
            @ModelAttribute CertificationDto certificationDto,
            @AuthenticationPrincipal Jwt jwt
    ) throws Exception {
        requireAdmin(jwt);
        log.info("Uploading certification image");

        String key = s3StorageService.uploadFile(certificationDto);

        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_PLAIN)
                .body(key);
    }

    @GetMapping("/view")
    public ResponseEntity<byte[]> viewFile(
            @RequestParam("key") String key,
            @AuthenticationPrincipal Jwt jwt
    ) {
        requireAuth(jwt);
        byte[] data = s3StorageService.downloadFile(key);

        String contentType = URLConnection.guessContentTypeFromName(key);

        if (contentType == null) {
            contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;
        }

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .body(data);
    }

    @GetMapping("/download")
    public ResponseEntity<byte[]> download(
            @RequestParam("key") String key,
            @AuthenticationPrincipal Jwt jwt
    ) {
        requireAuth(jwt);
        byte[] data = s3StorageService.downloadFile(key);

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + getFileName(key) + "\""
                )
                .body(data);
    }

    // Arbitrary-key deletion is destructive and has no per-owner check at this
    // generic layer (the key alone doesn't identify which lesson/enterprise/
    // learner it belongs to), so it's restricted to ADMIN rather than left
    // fully public -- previously anyone on the internet could delete any file
    // in the bucket by guessing/observing its key.
    @DeleteMapping
    public ResponseEntity<Void> delete(
            @RequestParam("key") String key,
            @AuthenticationPrincipal Jwt jwt
    ) {
        requireAdmin(jwt);
        s3StorageService.deleteFile(key);

        return ResponseEntity.noContent().build();
    }

    private void requireAdmin(Jwt jwt) {
        if (jwt == null) throw new IllegalArgumentException("Authentication is required");
        CurrentUserDto user = auth.syncCurrentUser(jwt, jwt.getTokenValue());
        if (!"ADMIN".equalsIgnoreCase(user.role())) throw new IllegalArgumentException("Admin access is required");
    }

    private void requireAuth(Jwt jwt) {
        if (jwt == null) throw new IllegalArgumentException("Authentication is required");
    }

    private void saveLessonMediaReference(
            FileDto fileDto,
            String key
    ) {
        String folderName = fileDto.getFolderName()
                .trim()
                .toLowerCase(Locale.ROOT);

        if ("photo".equals(folderName)) {
            lessonImageService.saveOrUpdateLessonImage(
                    fileDto.getLessonId(),
                    fileDto.getSectionName(),
                    fileDto.getToolId(),
                    key
            );

            return;
        }

        if ("video".equals(folderName)) {
            lessonVideoService.saveOrUpdateLessonVideo(
                    fileDto.getLessonId(),
                    fileDto.getSectionName(),
                    fileDto.getToolId(),
                    key
            );

            return;
        }

        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "folderName must be either 'photo' or 'video'."
        );
    }

    private void validateLessonMediaUpload(FileDto fileDto) {
        if (fileDto.getLessonId() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "lessonId is required."
            );
        }

        if (
                fileDto.getSectionName() == null ||
                        fileDto.getSectionName().isBlank()
        ) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "sectionName is required."
            );
        }

        if (
                fileDto.getToolId() == null ||
                        fileDto.getToolId().isBlank()
        ) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "toolId is required."
            );
        }

        if (
                fileDto.getFolderName() == null ||
                        fileDto.getFolderName().isBlank()
        ) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "folderName is required."
            );
        }

        if (
                fileDto.getFile() == null ||
                        fileDto.getFile().isEmpty()
        ) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "file is required."
            );
        }
    }

    private String getFileName(String key) {
        int lastSlashIndex = key.lastIndexOf("/");

        if (lastSlashIndex == -1) {
            return key;
        }

        return key.substring(lastSlashIndex + 1);
    }
}
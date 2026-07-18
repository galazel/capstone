package com.capstone.rebyu.certification.service;


import com.capstone.rebyu.certification.dto.CertificationDto;
import com.capstone.rebyu.certification.dto.FileDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.io.IOException;
import java.time.Duration;
import java.util.UUID;

@Service
public class S3StorageService {

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final String bucketName;
    private final LessonImageService lessonImageService;
    private final LessonVideoService lessonVideoService;

    public S3StorageService(S3Client s3Client, S3Presigner s3Presigner,
                            @Value("${aws.s3.bucket-name}") String bucketName,
                            LessonImageService lessonImageService, LessonVideoService lessonVideoService) {
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
        this.bucketName = bucketName;
        this.lessonImageService = lessonImageService;
        this.lessonVideoService = lessonVideoService;
    }

    /**
     * A short-lived presigned GET URL for a private object, forcing a download with the
     * given filename. The signature lives in the URL, so it works from an {@code <a href>}
     * without an Authorization header, yet expires quickly and can't be reused indefinitely.
     */
    public String presignDownloadUrl(String key, String downloadFilename, Duration ttl) {
        GetObjectRequest.Builder getRequest = GetObjectRequest.builder().bucket(bucketName).key(key);
        if (downloadFilename != null && !downloadFilename.isBlank()) {
            getRequest.responseContentDisposition(
                    "attachment; filename=\"" + downloadFilename.replace("\"", "") + "\"");
        }
        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(ttl)
                .getObjectRequest(getRequest.build())
                .build();
        return s3Presigner.presignGetObject(presignRequest).url().toString();
    }

    public String uploadFile(FileDto fileDto) throws Exception {
        String key;
        String folderName = fileDto.getFolderName();

        switch (folderName) {
            case "photo":
                key = "photos-modules/" + UUID.randomUUID() + fileDto.getToolId() + fileDto.getFile().getOriginalFilename();
                break;
            case "video":
                key = "videos-modules/" + UUID.randomUUID() + fileDto.getToolId() + fileDto.getFile().getOriginalFilename();
                break;
            default:
                throw new Exception("Invalid folder name");
        }

        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .contentType(fileDto.getFile().getContentType())
                .build();

        s3Client.putObject(putObjectRequest,
                RequestBody.fromInputStream(fileDto.getFile().getInputStream(), fileDto.getFile().getSize()));

        if (folderName.equals("photo"))
            lessonImageService.saveOrUpdateLessonImage(fileDto.getLessonId(), fileDto.getSectionName(), fileDto.getToolId(), key);
        else
            lessonVideoService.saveOrUpdateLessonVideo(fileDto.getLessonId(), fileDto.getSectionName(), fileDto.getToolId(), key);

        return key;
    }
    public String uploadFile(CertificationDto certificationDto) throws Exception {
        String key = "photos-certifications/" + UUID.randomUUID() + certificationDto.getCertificationId()+ certificationDto.getTitle();

        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .contentType(certificationDto.getFile().getContentType())
                .build();

        s3Client.putObject(putObjectRequest,
                RequestBody.fromInputStream(certificationDto.getFile().getInputStream(), certificationDto.getFile().getSize()));

        return key;
    }

    /**
     * Generic upload for features that just need a real file behind a stable
     * key (community post attachments, library files) — not tied to the
     * lesson/certification-specific DTOs above. Returns the S3 key; callers
     * persist that key themselves.
     */
    public String uploadFile(MultipartFile file, String folderPrefix) throws IOException {
        String originalName = file.getOriginalFilename() == null ? "file" : file.getOriginalFilename();
        String key = folderPrefix + "/" + UUID.randomUUID() + "-" + originalName;

        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .contentType(file.getContentType())
                .build();

        s3Client.putObject(putObjectRequest,
                RequestBody.fromInputStream(file.getInputStream(), file.getSize()));

        return key;
    }

    public byte[] downloadFile(String key) {
        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .build();

        ResponseBytes<GetObjectResponse> objectBytes = s3Client.getObjectAsBytes(getObjectRequest);
        return objectBytes.asByteArray();
    }

    public void deleteFile(String key) {
        DeleteObjectRequest deleteObjectRequest = DeleteObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .build();
        s3Client.deleteObject(deleteObjectRequest);
    }
}

package com.capstone.rebyu.enterprise;

import com.capstone.rebyu.certification.service.S3StorageService;
import com.capstone.rebyu.enterprise.entity.EnterpriseFile;
import com.capstone.rebyu.enterprise.repository.EnterpriseFileRepository;
import com.capstone.rebyu.organization.entity.Enterprise;
import com.capstone.rebyu.user.entity.User;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class EnterpriseFileService {

    private final EnterpriseFileRepository files;
    private final S3StorageService storage;

    public record FileView(Long id, String name, String contentType, long size, String storageKey, OffsetDateTime createdAt) {}

    public List<FileView> list(Long enterpriseId) {
        return files.findByEnterprise_EnterpriseIdOrderByCreatedAtDesc(enterpriseId).stream()
                .map(EnterpriseFileService::toView)
                .toList();
    }

    @Transactional
    public FileView upload(Long enterpriseId, Long userId, MultipartFile file) {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("A file is required");
        try {
            String key = storage.uploadFile(file, "enterprise-files/" + enterpriseId);
            EnterpriseFile entity = EnterpriseFile.builder()
                    .enterprise(Enterprise.builder().enterpriseId(enterpriseId).build())
                    .uploadedBy(userId == null ? null : User.builder().userId(userId).build())
                    .fileName(file.getOriginalFilename())
                    .contentType(file.getContentType())
                    .fileSize(file.getSize())
                    .storageKey(key)
                    .build();
            return toView(files.save(entity));
        } catch (IOException e) {
            throw new IllegalStateException("The organization file could not be uploaded", e);
        }
    }

    @Transactional
    public void delete(Long enterpriseId, Long fileId) {
        EnterpriseFile entity = files.findByEnterpriseFileIdAndEnterprise_EnterpriseId(fileId, enterpriseId)
                .orElseThrow(() -> new EntityNotFoundException("Organization file not found"));
        files.delete(entity);
        storage.deleteFile(entity.getStorageKey());
    }

    /**
     * A short-lived presigned download URL, but only if the file belongs to the caller's
     * enterprise. This replaces exposing the raw storage key via the public generic
     * /api/files/download endpoint (which any anonymous caller could hit).
     */
    @Transactional(readOnly = true)
    public String downloadUrl(Long enterpriseId, Long fileId) {
        EnterpriseFile entity = files.findByEnterpriseFileIdAndEnterprise_EnterpriseId(fileId, enterpriseId)
                .orElseThrow(() -> new EntityNotFoundException("Organization file not found"));
        return storage.presignDownloadUrl(entity.getStorageKey(), entity.getFileName(), Duration.ofMinutes(5));
    }

    private static FileView toView(EnterpriseFile entity) {
        return new FileView(entity.getEnterpriseFileId(), entity.getFileName(), entity.getContentType(),
                entity.getFileSize(), entity.getStorageKey(), entity.getCreatedAt());
    }
}

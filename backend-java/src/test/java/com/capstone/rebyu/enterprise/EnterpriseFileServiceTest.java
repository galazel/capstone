package com.capstone.rebyu.enterprise;

import com.capstone.rebyu.certification.service.S3StorageService;
import com.capstone.rebyu.enterprise.entity.EnterpriseFile;
import com.capstone.rebyu.enterprise.repository.EnterpriseFileRepository;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EnterpriseFileServiceTest {

    private static final Long ENTERPRISE_ID = 4L;
    private static final Long FILE_ID = 88L;

    private EnterpriseFileRepository files;
    private S3StorageService storage;
    private EnterpriseFileService service;

    @BeforeEach
    void setUp() {
        files = mock(EnterpriseFileRepository.class);
        storage = mock(S3StorageService.class);
        service = new EnterpriseFileService(files, storage);
    }

    @Test
    void downloadUrl_fileNotInEnterprise_throwsWithoutPresigning() {
        when(files.findByEnterpriseFileIdAndEnterprise_EnterpriseId(FILE_ID, ENTERPRISE_ID))
                .thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> service.downloadUrl(ENTERPRISE_ID, FILE_ID));
        verify(storage, never()).presignDownloadUrl(any(), any(), any());
    }

    @Test
    void downloadUrl_ownFile_returnsShortLivedPresignedUrl() {
        EnterpriseFile file = EnterpriseFile.builder()
                .enterpriseFileId(FILE_ID).fileName("agreement.pdf").storageKey("enterprise-files/4/x.pdf").build();
        when(files.findByEnterpriseFileIdAndEnterprise_EnterpriseId(FILE_ID, ENTERPRISE_ID))
                .thenReturn(Optional.of(file));
        when(storage.presignDownloadUrl(eq("enterprise-files/4/x.pdf"), eq("agreement.pdf"), any(Duration.class)))
                .thenReturn("https://s3.example/signed");

        String url = service.downloadUrl(ENTERPRISE_ID, FILE_ID);

        assertEquals("https://s3.example/signed", url);
    }
}

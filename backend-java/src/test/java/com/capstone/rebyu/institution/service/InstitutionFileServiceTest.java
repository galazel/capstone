package com.capstone.rebyu.institution.service;

import com.capstone.rebyu.certification.service.S3StorageService;
import com.capstone.rebyu.institution.entity.InstitutionFile;
import com.capstone.rebyu.institution.repository.InstitutionFileRepository;
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

class InstitutionFileServiceTest {

    private static final Long INSTITUTION_ID = 4L;
    private static final Long FILE_ID = 88L;

    private InstitutionFileRepository files;
    private S3StorageService storage;
    private InstitutionFileService service;

    @BeforeEach
    void setUp() {
        files = mock(InstitutionFileRepository.class);
        storage = mock(S3StorageService.class);
        service = new InstitutionFileService(files, storage);
    }

    @Test
    void downloadUrl_fileNotInInstitution_throwsWithoutPresigning() {
        when(files.findByInstitutionFileIdAndInstitution_InstitutionId(FILE_ID, INSTITUTION_ID))
                .thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> service.downloadUrl(INSTITUTION_ID, FILE_ID));
        verify(storage, never()).presignDownloadUrl(any(), any(), any());
    }

    @Test
    void downloadUrl_ownFile_returnsShortLivedPresignedUrl() {
        InstitutionFile file = InstitutionFile.builder()
                .institutionFileId(FILE_ID).fileName("agreement.pdf").storageKey("institution-files/4/x.pdf").build();
        when(files.findByInstitutionFileIdAndInstitution_InstitutionId(FILE_ID, INSTITUTION_ID))
                .thenReturn(Optional.of(file));
        when(storage.presignDownloadUrl(eq("institution-files/4/x.pdf"), eq("agreement.pdf"), any(Duration.class)))
                .thenReturn("https://s3.example/signed");

        String url = service.downloadUrl(INSTITUTION_ID, FILE_ID);

        assertEquals("https://s3.example/signed", url);
    }
}

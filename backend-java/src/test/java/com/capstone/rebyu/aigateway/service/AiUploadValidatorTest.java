package com.capstone.rebyu.aigateway.service;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AiUploadValidatorTest {

    private final AiUploadValidator validator = new AiUploadValidator();

    private MockMultipartFile pdf(String name, int sizeBytes) {
        return new MockMultipartFile("files", name, "application/pdf", new byte[sizeBytes]);
    }

    @Test
    void acceptsValidPdfDocAndCsv() {
        List<MultipartFile> files = List.of(
                pdf("syllabus.pdf", 1024),
                new MockMultipartFile("files", "outline.docx",
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document", new byte[10]),
                new MockMultipartFile("files", "topics.csv", "text/csv", new byte[10])
        );

        assertDoesNotThrow(() -> validator.validate(files));
    }

    @Test
    void rejectsMissingFiles() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> validator.validate(null));
        assertTrue(ex.getMessage().contains("At least one source document"));

        assertThrows(IllegalArgumentException.class,
                () -> validator.validate(Collections.emptyList()));
    }

    @Test
    void rejectsTooManyFiles() {
        List<MultipartFile> files = new java.util.ArrayList<>();
        for (int i = 0; i <= AiUploadValidator.MAX_FILES; i++) {
            files.add(pdf("doc" + i + ".pdf", 10));
        }

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> validator.validate(files));
        assertTrue(ex.getMessage().contains("maximum of " + AiUploadValidator.MAX_FILES));
    }

    @Test
    void rejectsUnsupportedExtension() {
        List<MultipartFile> files = List.of(
                new MockMultipartFile("files", "notes.txt", "text/plain", new byte[10])
        );

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> validator.validate(files));
        assertTrue(ex.getMessage().contains("Unsupported file"));
    }

    @Test
    void rejectsUnsupportedMimeTypeEvenWithAllowedExtension() {
        List<MultipartFile> files = List.of(
                new MockMultipartFile("files", "fake.pdf", "application/x-msdownload", new byte[10])
        );

        assertThrows(IllegalArgumentException.class, () -> validator.validate(files));
    }

    @Test
    void rejectsFileOverTenMegabytes() {
        List<MultipartFile> files = List.of(
                pdf("big.pdf", (int) AiUploadValidator.MAX_FILE_SIZE_BYTES + 1)
        );

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> validator.validate(files));
        assertTrue(ex.getMessage().contains("10 MB"));
    }

    @Test
    void rejectsEmptyFile() {
        List<MultipartFile> files = List.of(pdf("empty.pdf", 0));

        assertThrows(IllegalArgumentException.class, () -> validator.validate(files));
    }

    @Test
    void rejectsBlankExtractedText() {
        assertThrows(IllegalArgumentException.class, () -> validator.requireReadableText("   \n "));
        assertDoesNotThrow(() -> validator.requireReadableText("Actual document content"));
    }
}

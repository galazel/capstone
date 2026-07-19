package com.capstone.rebyu.ai.service;

import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Locale;
import java.util.Set;





@Component
public class AiUploadValidator {

    public static final int MAX_FILES = 10;
    public static final long MAX_FILE_SIZE_BYTES = 10L * 1024 * 1024;

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("pdf", "doc", "docx", "csv");

    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/csv",
            "application/csv",

            "application/vnd.ms-excel",

            "application/octet-stream"
    );

    public void validate(List<MultipartFile> files) {
        if (files == null || files.stream().noneMatch(f -> f != null && !f.isEmpty())) {
            throw new IllegalArgumentException("At least one source document is required.");
        }

        if (files.size() > MAX_FILES) {
            throw new IllegalArgumentException(
                    "A maximum of " + MAX_FILES + " source documents is allowed."
            );
        }

        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) {
                throw new IllegalArgumentException("One of the uploaded documents is empty.");
            }

            String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
            String extension = extractExtension(name);

            if (!ALLOWED_EXTENSIONS.contains(extension)) {
                throw new IllegalArgumentException(
                        "Unsupported file format for '" + name + "'. Allowed formats: PDF, DOC, DOCX, CSV."
                );
            }

            String contentType = file.getContentType();
            if (contentType != null && !contentType.isBlank()
                    && !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
                throw new IllegalArgumentException(
                        "Unsupported file type for '" + name + "'. Allowed formats: PDF, DOC, DOCX, CSV."
                );
            }

            if (file.getSize() > MAX_FILE_SIZE_BYTES) {
                throw new IllegalArgumentException(
                        "File '" + name + "' exceeds the 10 MB size limit."
                );
            }
        }
    }

    public void requireReadableText(String extractedText) {
        if (extractedText == null || extractedText.isBlank()) {
            throw new IllegalArgumentException(
                    "The uploaded documents contain no readable text. Upload documents with actual content."
            );
        }
    }

    private String extractExtension(String fileName) {
        int dot = fileName.lastIndexOf('.');
        if (dot < 0 || dot == fileName.length() - 1) {
            return "";
        }
        return fileName.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}

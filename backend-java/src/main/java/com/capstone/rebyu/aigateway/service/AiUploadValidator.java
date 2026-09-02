package com.capstone.rebyu.aigateway.service;

import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Locale;
import java.util.Set;





@Component
public class AiUploadValidator {

    public static final int MAX_FILES = 10;

    /**
     * Per-file ceiling for a source document.
     *
     * <p>Was 10MB, which is under the size of a real certification handbook and
     * silently cost a whole domain: TOPCIT's five official study guides are
     * 2-4MB each except Business, which is 194 pages and 12.2MB. That one was
     * rejected at upload while the other four went through, so the generated
     * curriculum came out with four majors instead of five -- and nothing
     * downstream could tell the difference between "the admin did not upload
     * Business" and "Business was refused".
     *
     * <p>50MB leaves real headroom for a scanned or image-heavy handbook, and
     * still fits {@link #MAX_FILES} of them inside the 500MB multipart request
     * ceiling in application.yaml. Keep this in step with MAX_SIZE_MB in
     * frontend/src/components/certifications/document-upload-step.jsx, which
     * rejects the file before it is ever sent.
     */
    public static final long MAX_FILE_SIZE_BYTES = 50L * 1024 * 1024;

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

package com.capstone.rebyu.aigateway.service;

import com.capstone.rebyu.aigateway.client.AiServiceClient;
import com.capstone.rebyu.aigateway.dto.LessonGenerationDraftResponseDto;
import com.capstone.rebyu.aigateway.entity.KnowledgeDocument;
import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.certification.repository.LessonRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

/**
 * Thin trigger: lesson content drafting is performed entirely by the Python
 * AI backend, which is expected to pull certification/lesson context and any
 * indexed knowledge itself. Java only validates the upload, stores the
 * source files, and forwards the request.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LessonGenerationService {

    private final LessonRepository lessonRepository;
    private final DocumentIngestionService documentIngestionService;
    private final AiUploadValidator aiUploadValidator;
    private final AiServiceClient aiServiceClient;

    public LessonGenerationDraftResponseDto generateDrafts(
            Long lessonId,
            List<MultipartFile> files,
            String additionalInstructions
    ) throws IOException {
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new EntityNotFoundException("Lesson not found: " + lessonId));
        Long certId = lesson.getMiddleCategory().getMajorCategory().getCertification().getCertificationId();

        List<MultipartFile> uploadedFiles = files == null
                ? List.of()
                : files.stream().filter(file -> file != null && !file.isEmpty()).toList();

        if (!uploadedFiles.isEmpty()) {
            aiUploadValidator.validate(uploadedFiles);
        }

        for (MultipartFile file : uploadedFiles) {
            documentIngestionService.ingest(file, certId, KnowledgeDocument.UseCase.LESSON);
        }

        log.info("Requesting lesson draft generation for lessonId={}", lessonId);
        return aiServiceClient.generateLessonDraft(lessonId, uploadedFiles, additionalInstructions);
    }
}

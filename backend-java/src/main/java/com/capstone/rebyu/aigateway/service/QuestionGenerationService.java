package com.capstone.rebyu.aigateway.service;

import com.capstone.rebyu.aigateway.dto.AiQuestionGenerationRequest;
import com.capstone.rebyu.aigateway.dto.GeneratedQuestionDraftResponseDto;
import com.capstone.rebyu.aigateway.entity.GenerationRequest;
import com.capstone.rebyu.aigateway.entity.KnowledgeDocument;
import com.capstone.rebyu.aigateway.repository.GenerationRequestRepository;
import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.certification.repository.CertificationRepository;
import com.capstone.rebyu.certification.repository.LessonRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Thin trigger: question drafting is performed entirely by the Python AI
 * backend's async LangGraph workflow, triggered by the RabbitMQ message
 * published here. Java validates the request against real certification/
 * lesson data, stores any uploaded source files, and publishes the trigger
 * -- it no longer calls the AI synchronously or persists drafts itself
 * (that is now the consumer's job; see python-backend's
 * app/messaging/handlers/question_generation.py, which writes approved
 * drafts to its own generated_question_drafts table).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class QuestionGenerationService {

    public record LessonRef(Long lessonId, String title) {}
    public record CertContext(String certTitle, Map<Long, LessonRef> lessonsById) {}

    private final LessonRepository lessonRepository;
    private final CertificationRepository certificationRepository;
    private final DocumentIngestionService documentIngestionService;
    private final AiUploadValidator aiUploadValidator;
    private final GenerationRequestRepository generationRequestRepository;
    private final GenerationRequestProducer generationRequestProducer;
    private final ObjectMapper objectMapper;

    public GeneratedQuestionDraftResponseDto generateDrafts(
            AiQuestionGenerationRequest request,
            List<MultipartFile> files,
            Long triggeredByUserId
    ) throws IOException {
        List<MultipartFile> uploadedFiles = files == null
                ? List.of()
                : files.stream().filter(f -> f != null && !f.isEmpty()).toList();

        CertContext ctx = loadCertificationContext(request.getCertificationId());
        if (ctx.lessonsById().isEmpty()) {
            throw new IllegalArgumentException(
                    "The selected certification has no lessons yet. Add lessons before generating questions."
            );
        }

        if (!uploadedFiles.isEmpty()) {
            aiUploadValidator.validate(uploadedFiles);
            for (MultipartFile file : uploadedFiles) {
                documentIngestionService.ingest(file, request.getCertificationId(), KnowledgeDocument.UseCase.QUESTION);
            }
        }

        GenerationRequest generationRequest = recordGenerationRequest(request, triggeredByUserId);
        generationRequestProducer.publishQuestionGenerationRequested(
                generationRequest.getGenerationRequestId(), request.getCertificationId());
        log.info("Published question generation request {} for certificationId={}",
                generationRequest.getGenerationRequestId(), request.getCertificationId());

        return new GeneratedQuestionDraftResponseDto(
                List.of(),
                new GeneratedQuestionDraftResponseDto.GenerationAnalysisDto(
                        request.getCertificationId(), request.getSourceMode(), request.getTargetQuestionCount(), 0, null, uploadedFiles.size()),
                List.of("Question generation started asynchronously; drafts are not ready yet.")
        );
    }

    private GenerationRequest recordGenerationRequest(AiQuestionGenerationRequest request, Long triggeredByUserId) {
        String paramsJson;
        try {
            paramsJson = objectMapper.writeValueAsString(request);
        } catch (Exception e) {
            paramsJson = null;
        }
        return generationRequestRepository.save(GenerationRequest.builder()
                .certificationId(request.getCertificationId())
                .requestType(GenerationRequest.RequestType.QUESTION)
                .paramsJson(paramsJson)
                .status(GenerationRequest.Status.PENDING)
                .triggeredByUserId(triggeredByUserId)
                .createdAt(LocalDateTime.now())
                .build());
    }

    @Transactional(readOnly = true)
    public CertContext loadCertificationContext(Long certificationId) {
        Certification cert = certificationRepository.findById(certificationId)
                .orElseThrow(() -> new EntityNotFoundException("Certification not found: " + certificationId));

        Map<Long, LessonRef> lessons = new LinkedHashMap<>();
        for (Lesson lesson : lessonRepository
                .findByMiddleCategory_MajorCategory_Certification_CertificationIdAndMiddleCategory_MajorCategory_OwnerGroupIsNull(
                        certificationId)) {
            lessons.put(lesson.getLessonId(), new LessonRef(lesson.getLessonId(), lesson.getName()));
        }
        return new CertContext(cert.getTitle(), lessons);
    }
}

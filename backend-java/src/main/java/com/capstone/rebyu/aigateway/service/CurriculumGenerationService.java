package com.capstone.rebyu.aigateway.service;

import com.capstone.rebyu.aigateway.entity.GenerationRequest;
import com.capstone.rebyu.aigateway.entity.KnowledgeDocument;
import com.capstone.rebyu.aigateway.repository.GenerationRequestRepository;
import com.capstone.rebyu.certification.dto.CertificationDto;
import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.certification.entity.MajorCategory;
import com.capstone.rebyu.certification.entity.MiddleCategory;
import com.capstone.rebyu.certification.mapper.CertificationMapper;
import com.capstone.rebyu.certification.repository.CertificationRepository;
import com.capstone.rebyu.certification.repository.LessonRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Thin trigger: curriculum generation itself is performed entirely by the
 * Python AI backend's async LangGraph workflow, triggered by the RabbitMQ
 * message published here. This class only creates/clears the certification
 * shell, records the source documents, and publishes the trigger -- it does
 * not call the AI or persist AI-generated structure itself, since that is
 * now the consumer's job (see python-backend's
 * app/messaging/handlers/certification_generation.py).
 */
@Slf4j
@Service
public class CurriculumGenerationService {

    record LessonCtx(Long lessonId, String lessonTitle, String midTitle, String majorTitle, String certTitle) {}

    private final CertificationRepository certificationRepository;
    private final LessonRepository lessonRepository;
    private final DocumentIngestionService documentIngestionService;
    private final CertificationMapper certificationMapper;
    private final AiUploadValidator aiUploadValidator;
    private final GenerationRequestRepository generationRequestRepository;
    private final GenerationRequestProducer generationRequestProducer;
    private final ObjectMapper objectMapper;

    @Autowired @Lazy
    private CurriculumGenerationService self;

    public CurriculumGenerationService(
            CertificationRepository certificationRepository,
            LessonRepository lessonRepository,
            DocumentIngestionService documentIngestionService,
            CertificationMapper certificationMapper,
            AiUploadValidator aiUploadValidator,
            GenerationRequestRepository generationRequestRepository,
            GenerationRequestProducer generationRequestProducer,
            ObjectMapper objectMapper
    ) {
        this.certificationRepository = certificationRepository;
        this.lessonRepository = lessonRepository;
        this.documentIngestionService = documentIngestionService;
        this.certificationMapper = certificationMapper;
        this.aiUploadValidator = aiUploadValidator;
        this.generationRequestRepository = generationRequestRepository;
        this.generationRequestProducer = generationRequestProducer;
        this.objectMapper = objectMapper;
    }

    /**
     * Creates a bare certification shell and hands off the actual curriculum
     * generation to the Python AI backend's LangGraph workflow via the
     * RabbitMQ trigger below -- Java no longer calls the AI synchronously or
     * persists AI-generated structure itself (that would race with, and
     * duplicate, whatever the async consumer writes). The returned DTO has
     * an empty category list until the consumer completes generation.
     */
    @Transactional
    public CertificationDto generateForNewCertification(
            CertificationDto dto,
            List<MultipartFile> files,
            String additionalInstructions,
            Long triggeredByUserId,
            String reviewMode,
            List<String> questionTypes
    ) throws IOException {
        aiUploadValidator.validate(files);

        String documentContent = extractText(files);
        aiUploadValidator.requireReadableText(documentContent);

        Long certificationId = self.createBareCertification(dto);
        log.info("Created certification {} (structure pending async generation)", certificationId);

        GenerationRequest request = recordGenerationRequest(
                certificationId, GenerationRequest.RequestType.CERTIFICATION, additionalInstructions,
                triggeredByUserId, reviewMode, MODE_REPLACE, questionTypes);
        publishAfterCommit(request.getGenerationRequestId(), certificationId);

        // Ingest the source so the async consumer (and later, per-lesson
        // generation) can read it back by certification id.
        ingestFiles(files, certificationId);

        return self.fetchCertificationDto(certificationId);
    }

    /**
     * Same async hand-off as {@link #generateForNewCertification}, but for
     * an existing certification: the current structure is cleared first
     * (ordinary data cleanup, not AI) so the consumer inserts into a clean
     * slate instead of appending to stale rows.
     */
    @Transactional
    public CertificationDto generateForExistingCertification(
            Long certificationId,
            List<MultipartFile> files,
            String additionalInstructions,
            Long triggeredByUserId,
            String reviewMode
    ) throws IOException {
        aiUploadValidator.validate(files);
        self.assertStructureReplaceable(certificationId);

        String documentContent = extractText(files);
        aiUploadValidator.requireReadableText(documentContent);

        self.clearStructure(certificationId);

        GenerationRequest request = recordGenerationRequest(
                certificationId, GenerationRequest.RequestType.CERTIFICATION, additionalInstructions,
                triggeredByUserId, reviewMode);
        publishAfterCommit(request.getGenerationRequestId(), certificationId);

        ingestFiles(files, certificationId);

        return self.fetchCertificationDto(certificationId);
    }

    /**
     * Adds to a certification instead of rebuilding it.
     *
     * <p>The difference from {@link #generateForExistingCertification} is the
     * one thing that method does first: it clears the structure. That is right
     * when an admin wants the curriculum rebuilt, and destructive when they
     * want another domain added -- and until now those were the same button,
     * so extending a certification meant re-authoring every lesson already
     * paid for and losing every question and assessment attached to them.
     *
     * <p>Nothing is deleted here. The new documents are ingested alongside the
     * existing ones, and the consumer is told to plan only what they add; the
     * persistence layer already matches on name, so anything the planner does
     * repeat is skipped rather than duplicated.
     *
     * <p>No {@code assertStructureReplaceable} check either: that guard exists
     * to stop an admin destroying a published certification's structure, and
     * an append destroys nothing.
     */
    @Transactional
    public CertificationDto appendToExistingCertification(
            Long certificationId,
            List<MultipartFile> files,
            String additionalInstructions,
            Long triggeredByUserId,
            String reviewMode,
            List<String> questionTypes
    ) throws IOException {
        aiUploadValidator.validate(files);

        String documentContent = extractText(files);
        aiUploadValidator.requireReadableText(documentContent);

        GenerationRequest request = recordGenerationRequest(
                certificationId, GenerationRequest.RequestType.CERTIFICATION, additionalInstructions,
                triggeredByUserId, reviewMode, MODE_APPEND, questionTypes);
        publishAfterCommit(request.getGenerationRequestId(), certificationId);

        ingestFiles(files, certificationId);

        log.info("Append generation queued for certification {}", certificationId);
        return self.fetchCertificationDto(certificationId);
    }

    /**
     * Queues the generation request, but only once the surrounding transaction
     * has actually committed.
     *
     * Publishing inline was a dual-write race, and a reliably losing one. These
     * methods are {@code @Transactional}, and the publish sat before
     * {@code ingestFiles(...)} â€” which uploads to S3 and extracts images, so it
     * can run for many seconds. The consumer received the message immediately,
     * looked up the generation request, and found nothing, because the inserting
     * transaction had not committed yet:
     *
     *   WARNING | generation_request 5 or certification 5 not found, dropping message
     *
     * Every generation was lost this way. The window was wide enough that it
     * failed essentially every time rather than intermittently, which is the
     * only reason it was easy to spot.
     *
     * Registering on {@code afterCommit} means the message is published exactly
     * when the data it refers to becomes visible to other connections. If the
     * transaction rolls back, no message is sent at all â€” previously a rollback
     * still left a message pointing at a row that never existed.
     */
    private void publishAfterCommit(Long generationRequestId, Long certificationId) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            // No surrounding transaction (a direct call, or a test): publishing
            // immediately is correct and there is nothing to wait for.
            generationRequestProducer.publishCertificationGenerationRequested(
                    generationRequestId, certificationId);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                generationRequestProducer.publishCertificationGenerationRequested(
                        generationRequestId, certificationId);
            }
        });
    }

    @Transactional(readOnly = true)
    public void assertStructureReplaceable(Long certificationId) {
        List<Lesson> lessons = lessonRepository
                .findByMiddleCategory_MajorCategory_Certification_CertificationIdAndMiddleCategory_MajorCategory_OwnerGroupIsNull(
                        certificationId);

        for (Lesson lesson : lessons) {
            String structure = lesson.getLessonComponentStructure();
            boolean hasContent = structure != null && !structure.isBlank() && !"[]".equals(structure.trim());
            boolean hasQuestions = lesson.getQuestionSet() != null && !lesson.getQuestionSet().isEmpty();

            if (hasContent || hasQuestions) {
                throw new IllegalStateException(
                        "This certification already has lesson content or questions. "
                                + "Generating a new structure would destroy existing data. "
                                + "Edit the structure manually instead."
                );
            }
        }
    }

    @Transactional
    public Long createBareCertification(CertificationDto dto) {
        Certification certification = certificationMapper.toEntity(dto);
        certification.setCertificationId(null);
        certification.setDateCreated(LocalDateTime.now());
        certification.setDateUpdated(null);
        certification.setMajorCategory(new ArrayList<>());

        Certification saved = certificationRepository.save(certification);
        return saved.getCertificationId();
    }

    @Transactional
    public void clearStructure(Long certificationId) {
        Certification cert = certificationRepository.findById(certificationId)
                .orElseThrow(() -> new EntityNotFoundException("Certification not found: " + certificationId));

        cert.getMajorCategory().clear();
        cert.setDateUpdated(LocalDateTime.now());
        certificationRepository.save(cert);
    }

    @Transactional
    public void saveLessonContent(Long lessonId, String contentJson) {
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new EntityNotFoundException("Lesson not found: " + lessonId));
        lesson.setLessonComponentStructure(contentJson);
        lessonRepository.save(lesson);
    }

    @Transactional(readOnly = true)
    public CertificationDto fetchCertificationDto(Long certificationId) {
        Certification cert = certificationRepository.findByIdWithFullTree(certificationId)
                .orElseThrow(() -> new EntityNotFoundException("Certification not found: " + certificationId));
        return certificationMapper.toDto(cert);
    }

    @Transactional(readOnly = true)
    public List<LessonCtx> loadLessonContexts(Long certificationId) {
        List<LessonCtx> contexts = new ArrayList<>();
        for (Lesson lesson : lessonRepository
                .findByMiddleCategory_MajorCategory_Certification_CertificationIdAndMiddleCategory_MajorCategory_OwnerGroupIsNull(
                        certificationId)) {
            String structure = lesson.getLessonComponentStructure();
            boolean isEmpty = structure == null || structure.isBlank() || "[]".equals(structure.trim());
            if (!isEmpty) {
                continue;
            }
            MiddleCategory mid = lesson.getMiddleCategory();
            MajorCategory major = mid.getMajorCategory();
            contexts.add(new LessonCtx(
                    lesson.getLessonId(),
                    lesson.getName(),
                    mid.getTitle(),
                    major.getTitle(),
                    major.getCertification() != null ? major.getCertification().getTitle() : ""
            ));
        }
        return contexts;
    }

    /**
     * Anything other than an explicit "auto" is supervised. Unrecognised input
     * must not silently turn a run the admin meant to review into one that
     * finishes without them.
     */
    private String normalizeReviewMode(String reviewMode) {
        return reviewMode != null && "auto".equalsIgnoreCase(reviewMode.trim()) ? "auto" : "guided";
    }

    private GenerationRequest recordGenerationRequest(
            Long certificationId, GenerationRequest.RequestType type, String additionalInstructions,
            Long triggeredByUserId, String reviewMode) {
        return recordGenerationRequest(
                certificationId, type, additionalInstructions, triggeredByUserId, reviewMode,
                MODE_REPLACE, null);
    }

    private GenerationRequest recordGenerationRequest(
            Long certificationId, GenerationRequest.RequestType type, String additionalInstructions,
            Long triggeredByUserId, String reviewMode, String mode) {
        return recordGenerationRequest(
                certificationId, type, additionalInstructions, triggeredByUserId, reviewMode, mode, null);
    }

    /** Build the whole curriculum from scratch. */
    static final String MODE_REPLACE = "replace";

    /**
     * Add to what is already there.
     *
     * <p>Read by the Python consumer, which plans against the existing
     * curriculum and asks only for what the new documents add -- so the lesson
     * agent never re-authors a lesson that exists. Recorded on the request row
     * rather than the queue message, for the same reason reviewMode is: a
     * retry re-reads this row, and a retry that quietly turned an append into
     * a replace would delete the certification it was meant to extend.
     */
    static final String MODE_APPEND = "append";

    /**
     * @param questionTypes the formats the admin ticked (MCQ, SHORT_ANSWER,
     *        DESCRIPTIVE, CRITICAL_THINKING), or null/empty to let the planner
     *        research them. Recorded on the request row rather than the queue
     *        message so a retry keeps the admin's answer -- a retry that lost
     *        it would silently rebuild the certification with different
     *        question formats than the one being repaired.
     */
    private GenerationRequest recordGenerationRequest(
            Long certificationId, GenerationRequest.RequestType type, String additionalInstructions,
            Long triggeredByUserId, String reviewMode, String mode, List<String> questionTypes) {
        String paramsJson;
        try {
            paramsJson = objectMapper.writeValueAsString(Map.of(
                    "additionalInstructions", additionalInstructions == null ? "" : additionalInstructions,
                    // Read back by Python when it seeds the run: "guided"
                    // pauses at every review checkpoint, "auto" generates
                    // straight through. Recorded on the request rather than
                    // sent on the queue message so a retry or restart -- which
                    // re-reads this row -- keeps the admin's choice.
                    "reviewMode", normalizeReviewMode(reviewMode),
                    "mode", mode,
                    // Empty list = "the planner decides", which is what every
                    // run did before this was offered.
                    "questionTypes", questionTypes == null ? List.of() : questionTypes));
        } catch (Exception e) {
            paramsJson = null;
        }
        return generationRequestRepository.save(GenerationRequest.builder()
                .certificationId(certificationId)
                .requestType(type)
                .paramsJson(paramsJson)
                .status(GenerationRequest.Status.PENDING)
                .triggeredByUserId(triggeredByUserId)
                .createdAt(LocalDateTime.now())
                .build());
    }

    private String extractText(List<MultipartFile> files) throws IOException {
        StringBuilder rawText = new StringBuilder();
        for (MultipartFile file : files) {
            if (file != null && !file.isEmpty()) {
                rawText.append(new String(file.getBytes(), StandardCharsets.UTF_8)).append("\n\n");
            }
        }
        return rawText.toString();
    }

    private void ingestFiles(List<MultipartFile> files, Long certificationId) {
        for (MultipartFile file : files) {
            if (file != null && !file.isEmpty()) {
                try {
                    documentIngestionService.ingest(file, certificationId, KnowledgeDocument.UseCase.LESSON);
                } catch (Exception e) {
                    log.warn("Failed to ingest '{}' for later reference: {}", file.getOriginalFilename(), e.getMessage());
                }
            }
        }
    }
}

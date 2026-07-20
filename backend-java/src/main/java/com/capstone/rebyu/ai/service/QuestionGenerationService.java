package com.capstone.rebyu.ai.service;

import com.capstone.rebyu.ai.assistant.QuestionGenerationAssistant;
import com.capstone.rebyu.ai.common.AiProviderRateLimitException;
import com.capstone.rebyu.ai.dto.AiQuestionGenerationRequest;
import com.capstone.rebyu.ai.dto.GeneratedQuestionDraftDto;
import com.capstone.rebyu.ai.dto.GeneratedQuestionDraftResponseDto;
import com.capstone.rebyu.ai.dto.GeneratedQuestionDraftResponseDto.GenerationAnalysisDto;
import com.capstone.rebyu.ai.dto.QuestionGenerationSourceMode;
import com.capstone.rebyu.ai.entity.KnowledgeDocument;
import com.capstone.rebyu.ai.entity.KnowledgeDocumentImage;
import com.capstone.rebyu.ai.repository.KnowledgeDocumentImageRepository;
import com.capstone.rebyu.ai.repository.KnowledgeDocumentRepository;
import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.certification.repository.CertificationRepository;
import com.capstone.rebyu.certification.repository.LessonRepository;
import com.capstone.rebyu.ai.common.InvalidAiGeneratedQuestionException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.Content;
import dev.langchain4j.data.message.ImageContent;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.TextContent;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.store.embedding.EmbeddingSearchRequest;
import dev.langchain4j.store.embedding.EmbeddingSearchResult;
import dev.langchain4j.store.embedding.EmbeddingStore;
import dev.langchain4j.store.embedding.filter.MetadataFilterBuilder;
import jakarta.persistence.EntityNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
public class QuestionGenerationService {

    private static final int MAX_DOC_CHARS = 50_000;
    private static final int MAX_QUESTIONS_PER_TYPE = 100;
    private static final int DEFAULT_TARGET = 100;
    private static final int MAX_TARGET = 250;
    private static final int TARGET_BATCH_SIZE = 20;
    private static final int MAX_TARGET_BATCH_ATTEMPTS = 25;
    private static final int MAX_EMPTY_BATCH_ATTEMPTS = 8;
    private static final int RETRIEVAL_MAX_RESULTS = 24;
    // Caps vision-model token/cost per request; the highest-similarity
    // chunks are searched first, so the first N distinct linked images are
    // already the most relevant ones.
    private static final int MAX_IMAGES_PER_REQUEST = 6;
    private static final java.util.Set<String> SUPPORTED_TYPES = java.util.Set.of(
            "MCQ", "SHORT_ANSWER", "DESCRIPTIVE", "PROGRAMMING", "DIAGRAM"
    );
    private static final java.util.Set<String> DIAGRAM_TYPES = java.util.Set.of(
            "ERD", "UML_CLASS", "UML_SEQUENCE", "FLOWCHART", "DFD", "MIND_MAP", "NETWORK_DIAGRAM"
    );

    public record LessonRef(Long lessonId, String title) {}
    public record CertContext(String certTitle, Map<Long, LessonRef> lessonsById) {}

    private final LessonRepository lessonRepository;
    private final CertificationRepository certificationRepository;
    private final DocumentIngestionService documentIngestionService;
    private final QuestionSourceImageService questionSourceImageService;
    private final QuestionGenerationAssistant questionGenerationAssistant;
    private final AiUploadValidator aiUploadValidator;
    private final GeneratedQuestionDraftValidator generatedQuestionDraftValidator;
    private final KnowledgeDocumentRepository knowledgeDocumentRepository;
    private final KnowledgeDocumentImageRepository knowledgeDocumentImageRepository;
    private final EmbeddingModel embeddingModel;
    private final EmbeddingStore<TextSegment> questionEmbeddingStore;
    private final EmbeddingStore<TextSegment> lessonEmbeddingStore;
    private final ObjectMapper objectMapper;
    // Tolerant reader for AI drafts: ignores stray fields (questionId,
    // lessonId, etc.) the model sometimes adds, without affecting the shared
    // application ObjectMapper.
    private final ObjectMapper draftMapper;
    // Used only for the manual multimodal call (retrieval-linked images); the
    // existing text-only questionGenerationAssistant path is untouched.
    private final ChatModel chatModel;

    public QuestionGenerationService(
            LessonRepository lessonRepository,
            CertificationRepository certificationRepository,
            DocumentIngestionService documentIngestionService,
            QuestionSourceImageService questionSourceImageService,
            QuestionGenerationAssistant questionGenerationAssistant,
            AiUploadValidator aiUploadValidator,
            GeneratedQuestionDraftValidator generatedQuestionDraftValidator,
            KnowledgeDocumentRepository knowledgeDocumentRepository,
            KnowledgeDocumentImageRepository knowledgeDocumentImageRepository,
            EmbeddingModel embeddingModel,
            @Qualifier("questionEmbeddingStore") EmbeddingStore<TextSegment> questionEmbeddingStore,
            @Qualifier("lessonEmbeddingStore") EmbeddingStore<TextSegment> lessonEmbeddingStore,
            ObjectMapper objectMapper,
            ChatModel chatModel
    ) {
        this.lessonRepository = lessonRepository;
        this.certificationRepository = certificationRepository;
        this.documentIngestionService = documentIngestionService;
        this.questionSourceImageService = questionSourceImageService;
        this.questionGenerationAssistant = questionGenerationAssistant;
        this.aiUploadValidator = aiUploadValidator;
        this.generatedQuestionDraftValidator = generatedQuestionDraftValidator;
        this.knowledgeDocumentRepository = knowledgeDocumentRepository;
        this.knowledgeDocumentImageRepository = knowledgeDocumentImageRepository;
        this.embeddingModel = embeddingModel;
        this.questionEmbeddingStore = questionEmbeddingStore;
        this.lessonEmbeddingStore = lessonEmbeddingStore;
        this.objectMapper = objectMapper;
        this.draftMapper = objectMapper.copy().disable(
                com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
        this.chatModel = chatModel;
    }

    public GeneratedQuestionDraftResponseDto generateDrafts(
            AiQuestionGenerationRequest request,
            List<MultipartFile> files
    ) throws IOException {
        List<String> warnings = new ArrayList<>();
        Set<String> sourceImageKeys = new HashSet<>();
        List<MultipartFile> uploadedFiles = files == null
                ? List.of()
                : files.stream().filter(f -> f != null && !f.isEmpty()).toList();

        CertContext ctx = loadCertificationContext(request.getCertificationId());
        if (ctx.lessonsById().isEmpty()) {
            throw new IllegalArgumentException(
                    "The selected certification has no lessons yet. Add lessons before generating questions."
            );
        }

        boolean hasKnowledge = knowledgeDocumentRepository.countByCertificationIdAndStatus(
                request.getCertificationId(), KnowledgeDocument.DocumentStatus.READY) > 0;
        QuestionGenerationSourceMode mode = resolveSourceMode(
                request.getSourceMode(), hasKnowledge, uploadedFiles);

        // --- Resolve grounded source context per mode -------------------
        String temporaryText = "";
        if (mode == QuestionGenerationSourceMode.UPLOADED_FILES
                || mode == QuestionGenerationSourceMode.COMBINED) {
            if (uploadedFiles.isEmpty()) {
                throw new IllegalArgumentException(
                        "Upload at least one source file for this generation mode.");
            }
            aiUploadValidator.validate(uploadedFiles);
            StringBuilder rawText = new StringBuilder();
            for (MultipartFile file : uploadedFiles) {
                String fallbackText = documentIngestionService.extractDocumentText(file);
                QuestionSourceImageService.ExtractedSource extracted =
                        questionSourceImageService.extract(file, fallbackText);
                rawText.append(extracted.text()).append("\n\n");
                sourceImageKeys.addAll(extracted.imageKeys());
            }
            aiUploadValidator.requireReadableText(rawText.toString());
            temporaryText = truncate(rawText.toString());
        }

        String retrievedKnowledge = "";
        int chunksUsed = 0;
        List<AvailableImage> availableImages = List.of();
        if (mode == QuestionGenerationSourceMode.CERTIFICATION_KNOWLEDGE
                || mode == QuestionGenerationSourceMode.COMBINED) {
            if (!hasKnowledge) {
                throw new IllegalArgumentException(
                        "This certification has no indexed knowledge yet. Upload a temporary file "
                                + "or add source materials to the certification first.");
            }
            List<RetrievedChunk> chunks = retrieveCertificationChunks(
                    request.getCertificationId(), ctx.certTitle(),
                    request.getAdditionalInstructions());
            chunksUsed = chunks.size();
            retrievedKnowledge = String.join("\n\n---\n\n",
                    chunks.stream().map(RetrievedChunk::text).toList());
            if (retrievedKnowledge.isBlank()) {
                warnings.add("Little indexed knowledge matched this certification; "
                        + "fewer questions may be generated.");
            }

            // Images linked to the matched chunks (nearest-match first) —
            // retrieved together with their text, never stored inside the
            // embedding itself.
            Set<String> retrievedImageKeys = new LinkedHashSet<>();
            for (RetrievedChunk chunk : chunks) {
                retrievedImageKeys.addAll(chunk.imageKeys());
            }
            availableImages = resolveAvailableImages(retrievedImageKeys);
        }

        // Permanent certification knowledge is listed first so it wins when
        // the two sources conflict.
        String referenceContext = switch (mode) {
            case CERTIFICATION_KNOWLEDGE -> retrievedKnowledge;
            case UPLOADED_FILES -> temporaryText;
            case COMBINED -> retrievedKnowledge
                    + "\n\n--- Additional uploaded material (secondary) ---\n\n"
                    + temporaryText;
        };
        if (referenceContext.isBlank()) {
            throw new InvalidAiGeneratedQuestionException(
                    "No readable source material was available to ground question generation.");
        }

        // --- Counts vs. AI-chosen types ---------------------------------
        Map<String, Integer> requestedCounts = null;
        int target;
        if (request.getQuestionCounts() != null && !request.getQuestionCounts().isEmpty()) {
            requestedCounts = normalizeCounts(request.getQuestionCounts());
            target = requestedCounts.values().stream().mapToInt(Integer::intValue).sum();
        } else {
            target = request.getTargetQuestionCount() == null
                    ? DEFAULT_TARGET
                    : Math.max(1, Math.min(MAX_TARGET, request.getTargetQuestionCount()));
        }

        log.info("Generating question drafts for certificationId={} mode={} target={} images={}",
                request.getCertificationId(), mode, target, availableImages.size());

        List<GeneratedQuestionDraftDto> validDrafts = requestedCounts != null
                ? generateStrictCountDrafts(
                        request, ctx, requestedCounts, target, referenceContext, availableImages, warnings)
                : generateTargetDrafts(
                        request, ctx, target, referenceContext, availableImages, warnings);

        // Both source-marker keys (uploaded files) and retrieval-linked keys
        // are trusted; anything else the AI returns is stripped.
        Set<String> trustedImageKeys = new HashSet<>(sourceImageKeys);
        availableImages.forEach(image -> trustedImageKeys.add(image.imageKey()));
        validDrafts = sanitizeImageReferences(validDrafts, trustedImageKeys);

        if (requestedCounts != null) {
            Map<String, Long> producedByType = validDrafts.stream()
                    .collect(java.util.stream.Collectors.groupingBy(
                            d -> d.questionType().name(), java.util.stream.Collectors.counting()));
            requestedCounts.forEach((type, requested) -> {
                long produced = producedByType.getOrDefault(type, 0L);
                if (produced < requested) {
                    warnings.add("Requested " + requested + " " + type
                            + " question(s) but the source material supported "
                            + produced + ". Regenerate to try for more.");
                }
            });
        } else if (validDrafts.size() < target) {
            warnings.add("The grounded source material supported "
                    + validDrafts.size() + " of the " + target + " requested questions.");
        }

        if (requestedCounts == null && validDrafts.size() >= 3) {
            long typeCount = validDrafts.stream()
                    .map(draft -> draft.questionType().name())
                    .distinct()
                    .count();
            if (typeCount < 3) {
                warnings.add("The AI returned limited question-type variety. "
                        + "Regenerate or add more varied source material to get at least 3 question types.");
            }
        }

        log.info("Generated {} valid question draft(s) for certificationId={}",
                validDrafts.size(), request.getCertificationId());

        return new GeneratedQuestionDraftResponseDto(
                validDrafts,
                new GenerationAnalysisDto(
                        request.getCertificationId(),
                        mode,
                        target,
                        validDrafts.size(),
                        chunksUsed,
                        uploadedFiles.size()),
                warnings
        );
    }

    private List<GeneratedQuestionDraftDto> sanitizeImageReferences(
            List<GeneratedQuestionDraftDto> drafts, Set<String> allowedKeys) {
        return drafts.stream().map(draft -> {
            String questionImageKey = allowedKeys.contains(draft.imageKey())
                    ? draft.imageKey() : null;
            List<com.capstone.rebyu.ai.dto.GeneratedChoiceDto> choices = draft.choices() == null
                    ? null
                    : draft.choices().stream().map(choice ->
                            new com.capstone.rebyu.ai.dto.GeneratedChoiceDto(
                                    choice.choiceText(),
                                    choice.explanation(),
                                    choice.isCorrect(),
                                    allowedKeys.contains(choice.imageKey()) ? choice.imageKey() : null))
                    .toList();
            return new GeneratedQuestionDraftDto(
                    draft.questionType(), draft.suggestedLessonId(),
                    draft.suggestedLessonTitle(), draft.question(), draft.difficulty(),
                    choices, draft.correctChoiceIndex(), draft.correctAnswer(),
                    draft.checkingMethod(), draft.rubricBasedAnswer(), draft.starterCode(),
                    draft.testCases(), draft.diagramType(), draft.instructions(),
                    draft.authoringNotes(), questionImageKey, draft.acceptedVariations());
        }).toList();
    }

    private QuestionGenerationSourceMode resolveSourceMode(
            QuestionGenerationSourceMode requested,
            boolean hasKnowledge,
            List<MultipartFile> files) {
        if (requested != null) {
            return requested;
        }
        // Default to permanent knowledge when it exists; otherwise files.
        if (hasKnowledge && files.isEmpty()) {
            return QuestionGenerationSourceMode.CERTIFICATION_KNOWLEDGE;
        }
        if (hasKnowledge) {
            return QuestionGenerationSourceMode.COMBINED;
        }
        return QuestionGenerationSourceMode.UPLOADED_FILES;
    }

    /** One retrieved chunk with the image keys linked to it (see DocumentIngestionService), if any. */
    private record RetrievedChunk(String text, Set<String> imageKeys) {}

    /** One image resolved and ready to attach to a multimodal prompt, with its trusted imageKey. */
    private record AvailableImage(String imageKey, String contentType, String base64Data, String caption) {}

    /**
     * Retrieves chunks strictly filtered to this certification's metadata.
     * Certification source documents uploaded during certification
     * creation/editing are embedded in the knowledge (lesson) store, while
     * question-specific uploads land in the question store — so both stores
     * are searched and merged.
     */
    private List<RetrievedChunk> retrieveCertificationChunks(
            Long certificationId, String certTitle, String additionalInstructions) {
        try {
            String queryText = additionalInstructions == null || additionalInstructions.isBlank()
                    ? certTitle
                    : certTitle + " — " + additionalInstructions;
            EmbeddingSearchRequest searchRequest = EmbeddingSearchRequest.builder()
                    .queryEmbedding(embeddingModel.embed(queryText).content())
                    .maxResults(RETRIEVAL_MAX_RESULTS)
                    .filter(MetadataFilterBuilder.metadataKey("certificationId")
                            .isEqualTo(String.valueOf(certificationId)))
                    .build();

            List<RetrievedChunk> chunks = new ArrayList<>();
            chunks.addAll(searchStore(questionEmbeddingStore, searchRequest, "question"));
            if (chunks.size() < RETRIEVAL_MAX_RESULTS) {
                chunks.addAll(searchStore(lessonEmbeddingStore, searchRequest, "knowledge"));
            }
            return chunks.stream().distinct().limit(RETRIEVAL_MAX_RESULTS).toList();
        } catch (Exception e) {
            log.warn("Certification-filtered retrieval failed: {}", e.getMessage());
            return List.of();
        }
    }

    private List<RetrievedChunk> searchStore(
            EmbeddingStore<TextSegment> store, EmbeddingSearchRequest request, String label) {
        try {
            EmbeddingSearchResult<TextSegment> result = store.search(request);
            return result.matches().stream()
                    .map(match -> {
                        String imageKeysCsv = match.embedded().metadata().getString("imageKeys");
                        Set<String> imageKeys = imageKeysCsv == null || imageKeysCsv.isBlank()
                                ? Set.<String>of()
                                : Set.of(imageKeysCsv.split(","));
                        return new RetrievedChunk(match.embedded().text(), imageKeys);
                    })
                    .toList();
        } catch (Exception e) {
            log.warn("Retrieval from {} store failed: {}", label, e.getMessage());
            return List.of();
        }
    }

    /**
     * Resolves retrieval-linked image keys into ready-to-attach images
     * (capped, downloaded, base64-encoded). Never throws — an unreadable
     * image is skipped with a warning rather than failing the whole
     * generation request.
     */
    private List<AvailableImage> resolveAvailableImages(Set<String> imageKeys) {
        if (imageKeys.isEmpty()) {
            return List.of();
        }
        List<KnowledgeDocumentImage> found =
                knowledgeDocumentImageRepository.findByImageKeyIn(imageKeys);

        List<AvailableImage> available = new ArrayList<>();
        for (KnowledgeDocumentImage image : found) {
            if (available.size() >= MAX_IMAGES_PER_REQUEST) {
                break;
            }
            try {
                String base64 = questionSourceImageService.downloadAsBase64(image.getImageKey());
                available.add(new AvailableImage(
                        image.getImageKey(),
                        image.getContentType() == null ? "image/png" : image.getContentType(),
                        base64,
                        image.getNearbyText()));
            } catch (Exception e) {
                log.warn("Could not load linked image '{}' for question generation: {}",
                        image.getImageKey(), e.getMessage());
            }
        }
        return available;
    }

    private String truncate(String text) {
        return text.length() > MAX_DOC_CHARS ? text.substring(0, MAX_DOC_CHARS) : text;
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

    private Map<String, Integer> normalizeCounts(Map<String, Integer> counts) {
        Map<String, Integer> normalized = new LinkedHashMap<>();
        for (Map.Entry<String, Integer> entry : counts.entrySet()) {
            String type = entry.getKey() == null ? "" : entry.getKey().trim().toUpperCase(Locale.ROOT);
            int count = entry.getValue() == null ? 0 : entry.getValue();

            if (count == 0) {
                continue;
            }
            if (!SUPPORTED_TYPES.contains(type)) {
                throw new IllegalArgumentException("Unsupported question type: " + entry.getKey());
            }
            if (count < 0 || count > MAX_QUESTIONS_PER_TYPE) {
                throw new IllegalArgumentException(
                        "Question count for " + type + " must be between 1 and " + MAX_QUESTIONS_PER_TYPE + "."
                );
            }
            normalized.put(type, count);
        }

        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("Request at least one question for any question type.");
        }
        return normalized;
    }

    private List<GeneratedQuestionDraftDto> generateStrictCountDrafts(
            AiQuestionGenerationRequest request,
            CertContext ctx,
            Map<String, Integer> requestedCounts,
            int target,
            String referenceContext,
            List<AvailableImage> availableImages,
            List<String> warnings
    ) throws IOException {
        String requestJson = buildRequestJson(request, ctx, requestedCounts, target, List.of());
        List<GeneratedQuestionDraftDto> generatedDrafts =
                requestDraftBatch(request, requestJson, referenceContext, availableImages, 2);
        generatedDrafts = assignMissingLessons(generatedDrafts, ctx, warnings);
        generatedDrafts = normalizeQuestionTypeDrafts(generatedDrafts, ctx, warnings);
        return generatedQuestionDraftValidator.validateLenient(
                generatedDrafts, ctx.lessonsById(), warnings);
    }

    private List<GeneratedQuestionDraftDto> generateTargetDrafts(
            AiQuestionGenerationRequest request,
            CertContext ctx,
            int target,
            String referenceContext,
            List<AvailableImage> availableImages,
            List<String> warnings
    ) throws IOException {
        List<GeneratedQuestionDraftDto> accepted = new ArrayList<>();
        Set<String> acceptedQuestions = new HashSet<>();
        int maxAttempts = Math.min(
                MAX_TARGET_BATCH_ATTEMPTS,
                Math.max(8, (int) Math.ceil((double) target / TARGET_BATCH_SIZE) * 3)
        );
        int emptyAttempts = 0;

        for (int attempt = 1; attempt <= maxAttempts && accepted.size() < target; attempt++) {
            int remaining = target - accepted.size();
            int batchTarget = Math.min(TARGET_BATCH_SIZE, remaining);
            String requestJson = buildRequestJson(
                    request,
                    ctx,
                    null,
                    batchTarget,
                    accepted.stream().map(GeneratedQuestionDraftDto::question).toList()
            );

            List<GeneratedQuestionDraftDto> generatedDrafts;
            try {
                generatedDrafts = requestDraftBatch(request, requestJson, referenceContext, availableImages, 2);
            } catch (AiProviderRateLimitException e) {
                if (!accepted.isEmpty()) {
                    warnings.add(e.getMessage() + " Returning " + accepted.size()
                            + " questions generated before the provider limit was reached.");
                    break;
                }
                throw e;
            } catch (InvalidAiGeneratedQuestionException e) {
                warnings.add("One generation batch was skipped because the AI returned malformed drafts.");
                emptyAttempts++;
                if (emptyAttempts >= MAX_EMPTY_BATCH_ATTEMPTS && !accepted.isEmpty()) break;
                continue;
            }

            generatedDrafts = assignMissingLessons(generatedDrafts, ctx, warnings);
            generatedDrafts = normalizeQuestionTypeDrafts(generatedDrafts, ctx, warnings);
            List<GeneratedQuestionDraftDto> validBatch;
            try {
                validBatch = generatedQuestionDraftValidator.validateLenient(
                        generatedDrafts, ctx.lessonsById(), warnings);
            } catch (InvalidAiGeneratedQuestionException e) {
                emptyAttempts++;
                if (emptyAttempts >= MAX_EMPTY_BATCH_ATTEMPTS && !accepted.isEmpty()) break;
                continue;
            }

            int added = 0;
            for (GeneratedQuestionDraftDto draft : validBatch) {
                String normalizedQuestion = normalizeQuestionText(draft.question());
                if (!acceptedQuestions.add(normalizedQuestion)) {
                    warnings.add("Skipped a duplicate generated question.");
                    continue;
                }
                accepted.add(draft);
                added++;
                if (accepted.size() >= target) break;
            }

            if (added == 0) {
                emptyAttempts++;
                if (emptyAttempts >= MAX_EMPTY_BATCH_ATTEMPTS) break;
            } else {
                emptyAttempts = 0;
            }
        }

        if (accepted.isEmpty()) {
            throw new InvalidAiGeneratedQuestionException(
                    "The AI did not return any valid question drafts. Please try again.");
        }
        if (accepted.size() < target) {
            warnings.add("Generated " + accepted.size() + " of " + target
                    + " requested questions after " + maxAttempts
                    + " batch attempt(s). Add more source material or regenerate to continue.");
        }
        return accepted;
    }

    private List<GeneratedQuestionDraftDto> requestDraftBatch(
            AiQuestionGenerationRequest request,
            String requestJson,
            String referenceContext,
            List<AvailableImage> availableImages,
            int maxAttempts
    ) {
        InvalidAiGeneratedQuestionException lastParseError = null;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                // The existing text-only path is used whenever there are no
                // retrieval-linked images to show the model; the multimodal
                // path is purely additive.
                String aiResponse = availableImages.isEmpty()
                        ? questionGenerationAssistant.generateQuestions(requestJson, referenceContext)
                        : generateQuestionsWithImages(requestJson, referenceContext, availableImages);
                return parseGeneratedQuestionDrafts(aiResponse);
            } catch (InvalidAiGeneratedQuestionException e) {
                lastParseError = e;
                log.warn("Attempt {}/{}: unparseable question draft response for certificationId={}: {}",
                        attempt, maxAttempts, request.getCertificationId(), e.getMessage());
            } catch (Exception e) {
                if (isRateLimitException(e)) {
                    throw new AiProviderRateLimitException(
                            "The AI provider is temporarily rate limiting question generation. "
                                    + "Please wait a minute and try again.", e);
                }
                log.error("Failed to deserialize AI question draft response for certificationId={}",
                        request.getCertificationId(), e);
                throw new InvalidAiGeneratedQuestionException(
                        "The AI returned invalid question drafts. Please check the format and try again.", e);
            }
        }
        throw lastParseError != null
                ? lastParseError
                : new InvalidAiGeneratedQuestionException(
                        "The AI returned malformed question draft JSON. Please try again.");
    }

    /**
     * Vision-capable call path used only when retrieval linked real images
     * to the matched chunks. Bypasses the declarative
     * {@code QuestionGenerationAssistant} (its {@code @UserMessage}
     * templating is text-only) and calls {@code ChatModel} directly with a
     * manually-built multimodal message, reusing the SAME system prompt
     * ({@link QuestionGenerationAssistant#SYSTEM_PROMPT}) so output format
     * and question-quality rules stay identical to the text-only path.
     * Each image is preceded by a "imageId: ..." text part so the model can
     * correlate what it sees with the trusted key it must copy back.
     */
    private String generateQuestionsWithImages(
            String requestJson, String referenceContext, List<AvailableImage> availableImages) {
        List<Content> userContents = new ArrayList<>();

        StringBuilder catalog = new StringBuilder();
        catalog.append("AVAILABLE IMAGES — each one below is shown to you with its trusted imageId. ")
                .append("Choose an imageId ONLY if that exact image is genuinely relevant to a question ")
                .append("or choice; copy it EXACTLY into that question's or choice's imageKey field. ")
                .append("Never invent an imageId, never guess one that was not shown, and leave imageKey ")
                .append("blank when none of these images is relevant.\n");
        userContents.add(TextContent.from(catalog.toString()));

        for (AvailableImage image : availableImages) {
            StringBuilder caption = new StringBuilder("imageId: ").append(image.imageKey());
            if (image.caption() != null && !image.caption().isBlank()) {
                caption.append(" — nearby source text: ").append(image.caption());
            }
            userContents.add(TextContent.from(caption.toString()));
            userContents.add(ImageContent.from(image.base64Data(), image.contentType()));
        }

        userContents.add(TextContent.from("""
                Generate question-bank draft questions.

                Question generation request:
                %s

                Reference context:
                %s

                Return only structured question draft data as a valid JSON array.
                """.formatted(requestJson, referenceContext)));

        List<ChatMessage> messages = List.of(
                SystemMessage.from(QuestionGenerationAssistant.SYSTEM_PROMPT),
                UserMessage.from(userContents));
        return chatModel.chat(messages).aiMessage().text();
    }

    private boolean isRateLimitException(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            String className = current.getClass().getName().toLowerCase(Locale.ROOT);
            String message = current.getMessage() == null
                    ? ""
                    : current.getMessage().toLowerCase(Locale.ROOT);
            if (className.contains("ratelimit")
                    || message.contains("too many requests")
                    || message.contains("rate limit")) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private List<GeneratedQuestionDraftDto> normalizeQuestionTypeDrafts(
            List<GeneratedQuestionDraftDto> drafts,
            CertContext ctx,
            List<String> warnings
    ) {
        if (drafts == null || drafts.isEmpty()) {
            return drafts;
        }

        boolean convertedTopcitShortAnswer = false;
        boolean convertedNonExactShortAnswer = false;
        List<GeneratedQuestionDraftDto> normalized = new ArrayList<>(drafts.size());
        for (GeneratedQuestionDraftDto draft : drafts) {
            if (draft != null
                    && draft.questionType() == com.capstone.rebyu.ai.dto.GeneratedQuestionType.SHORT_ANSWER
                    && (isTopcit(ctx.certTitle())
                        || !isExactShortAnswerPrompt(draft.question())
                        || !isShortSpecificAnswer(draft.correctAnswer()))) {
                if (isTopcit(ctx.certTitle())) {
                    convertedTopcitShortAnswer = true;
                } else {
                    convertedNonExactShortAnswer = true;
                }
                normalized.add(toDescriptiveDraft(draft));
            } else {
                normalized.add(draft);
            }
        }
        if (convertedTopcitShortAnswer) {
            warnings.add("Converted TOPCIT short-answer drafts to descriptive questions to match the TOPCIT exam style.");
        }
        if (convertedNonExactShortAnswer) {
            warnings.add("Converted non-exact short-answer drafts to descriptive questions.");
        }
        return normalized;
    }

    private GeneratedQuestionDraftDto toDescriptiveDraft(GeneratedQuestionDraftDto draft) {
        String rubric = draft.rubricBasedAnswer();
        if (rubric == null || rubric.isBlank()) {
            rubric = draft.correctAnswer();
        }
        if (rubric == null || rubric.isBlank()) {
            rubric = "Evaluate the response for conceptual correctness, completeness, and relevance to the source material.";
        }
        return new GeneratedQuestionDraftDto(
                com.capstone.rebyu.ai.dto.GeneratedQuestionType.DESCRIPTIVE,
                draft.suggestedLessonId(),
                draft.suggestedLessonTitle(),
                draft.question(),
                draft.difficulty(),
                null,
                null,
                null,
                com.capstone.rebyu.ai.dto.GeneratedCheckingMethod.AI_SEMANTIC,
                rubric,
                draft.starterCode(),
                draft.testCases(),
                draft.diagramType(),
                draft.instructions(),
                draft.authoringNotes()
        );
    }

    /**
     * A valid short answer is one short, specific token or phrase — a word,
     * term, acronym, number, or short phrase. Anything that reads like an
     * explanation, a list, or multiple sentences is rejected so it becomes a
     * descriptive question instead. The "TODO" placeholder answer is allowed so
     * the author can complete it.
     */
    private boolean isShortSpecificAnswer(String answer) {
        if (answer == null) {
            return false;
        }
        String trimmed = answer.trim();
        if (trimmed.isEmpty()) {
            return false;
        }
        if (trimmed.startsWith("TODO")) {
            return true; // author-completed placeholder
        }
        if (trimmed.length() > 60) {
            return false; // too long to be one specific answer
        }
        if (trimmed.split("\\s+").length > 6) {
            return false; // longer than a short phrase
        }
        if (trimmed.contains(";") || trimmed.contains("\n")) {
            return false; // enumeration / multi-line
        }
        if (trimmed.matches(".*[.!?]\\s+\\S.*")) {
            return false; // a sentence break followed by more text => explanatory
        }
        if (trimmed.matches("(?s).*,.*,.*")) {
            return false; // three or more comma-separated items => a list
        }
        return true;
    }

    private boolean isExactShortAnswerPrompt(String question) {
        if (question == null || question.isBlank()) return false;
        String normalized = question.trim().toLowerCase(Locale.ROOT);
        return !(normalized.startsWith("explain ")
                || normalized.startsWith("describe ")
                || normalized.startsWith("compare ")
                || normalized.startsWith("contrast ")
                || normalized.startsWith("why ")
                || normalized.startsWith("how ")
                || normalized.contains(" explain ")
                || normalized.contains(" describe ")
                || normalized.contains(" compare ")
                || normalized.contains(" discuss ")
                || normalized.contains("analyze "));
    }

    private boolean isTopcit(String certTitle) {
        return certTitle != null && certTitle.toLowerCase(Locale.ROOT).contains("topcit");
    }

    private String buildRequestJson(
            AiQuestionGenerationRequest request,
            CertContext ctx,
            Map<String, Integer> requestedCounts,
            int target,
            List<String> existingQuestions
    ) throws IOException {
        List<Map<String, Object>> availableLessons = ctx.lessonsById().values().stream()
                .map(l -> Map.<String, Object>of("lessonId", l.lessonId(), "lessonTitle", l.title()))
                .toList();

        Map<String, Object> requestData = new LinkedHashMap<>();
        requestData.put("certificationId", request.getCertificationId());
        requestData.put("certificationTitle", ctx.certTitle());
        requestData.put("availableLessons", availableLessons);
        // Reinforced every batch so drafts follow concise professional exam style.
        requestData.put("styleGuide",
                "Generate concise, professional IT certification-exam questions similar to "
                        + "TOPCIT or PhilNITS. Prefer direct technical stems, calculations, "
                        + "binary/logic operations, code or SQL interpretation, data structures, "
                        + "architecture, standards, and precise Which-of-the-following questions. "
                        + "Do not force workplace scenarios. Avoid repetitive openings such as "
                        + "A company, An enterprise, An organization, A team, A developer, or named "
                        + "people. Use a situation only when its facts are required to solve the "
                        + "technical problem. Keep wording mature, objective, and exam-grade, with "
                        + "plausible MCQ distractors.");
        if (requestedCounts != null) {
            requestData.put("questionCounts", requestedCounts);
        } else {
            requestData.put("targetQuestionCount", target);
            requestData.put("batchMode", true);
            requestData.put("batchInstruction",
                    "Generate only targetQuestionCount questions for this batch. "
                            + "The backend will request additional batches until the full total is reached.");
            requestData.put("typeSelection",
                    "Generate a mixed question set using at least 3 different supported question types "
                            + "when the source material can support that variety. Do not return only one "
                            + "question type. Use PROGRAMMING only when the source contains code, algorithms, "
                            + "query writing, or implementation tasks. Use DIAGRAM only when the source "
                            + "contains workflows, database/schema design, architecture, UML/ERD/DFD, "
                            + "or process modeling material. Return fewer questions only when the material "
                            + "is insufficient.");
        }
        if (existingQuestions != null && !existingQuestions.isEmpty()) {
            requestData.put("avoidDuplicateQuestions", existingQuestions.stream()
                    .filter(question -> question != null && !question.isBlank())
                    .limit(80)
                    .toList());
            requestData.put("continuationInstruction",
                    "This is a continuation batch. Do not repeat or rephrase any avoidDuplicateQuestions.");
        }
        if (request.getAdditionalInstructions() != null && !request.getAdditionalInstructions().isBlank()) {
            requestData.put("additionalInstructions", request.getAdditionalInstructions());
        }
        return objectMapper.writeValueAsString(requestData);
    }

    private String normalizeQuestionText(String text) {
        if (text == null) return "";
        return java.util.regex.Pattern.compile("\\s+")
                .matcher(text.trim().toLowerCase(Locale.ROOT))
                .replaceAll(" ");
    }

    /**
     * Safe JSON extraction: plain arrays, fenced blocks, arrays embedded in
     * prose, {"questions":[...]} wrappers, and single-object responses.
     */
    private List<GeneratedQuestionDraftDto> parseGeneratedQuestionDrafts(String json) {
        if (json == null || json.isBlank()) {
            throw new InvalidAiGeneratedQuestionException("The AI returned an empty response.");
        }
        String cleaned = json.trim();
        if (cleaned.startsWith("```")) {
            cleaned = cleaned.replaceFirst("```[a-zA-Z]*\\n?", "").replaceAll("```$", "").trim();
        }

        List<GeneratedQuestionDraftDto> direct = tryParseArray(cleaned);
        if (direct != null) return direct;

        int arrayStart = cleaned.indexOf('[');
        int arrayEnd = cleaned.lastIndexOf(']');
        if (arrayStart >= 0 && arrayEnd > arrayStart) {
            List<GeneratedQuestionDraftDto> embedded =
                    tryParseArray(cleaned.substring(arrayStart, arrayEnd + 1));
            if (embedded != null) return embedded;
        }

        // Truncated output (token limit hit mid-array): keep every complete
        // top-level object and close the array after the last one.
        if (arrayStart >= 0) {
            String salvaged = salvageTruncatedArray(cleaned, arrayStart);
            if (salvaged != null) {
                List<GeneratedQuestionDraftDto> recovered = tryParseArray(salvaged);
                if (recovered != null && !recovered.isEmpty()) {
                    log.warn("Recovered {} question draft(s) from a truncated AI response",
                            recovered.size());
                    return recovered;
                }
            }
        }

        int objStart = cleaned.indexOf('{');
        int objEnd = cleaned.lastIndexOf('}');
        if (objStart >= 0 && objEnd > objStart) {
            String obj = cleaned.substring(objStart, objEnd + 1);
            try {
                JsonNode node = objectMapper.readTree(obj);
                if (node.has("questions") && node.get("questions").isArray()) {
                    List<GeneratedQuestionDraftDto> wrapped =
                            tryParseArray(node.get("questions").toString());
                    if (wrapped != null) return wrapped;
                }
                // Single-object regeneration response.
                GeneratedQuestionDraftDto single =
                        draftMapper.treeToValue(normalizeDraftNode(node), GeneratedQuestionDraftDto.class);
                if (single != null && single.question() != null) {
                    return List.of(single);
                }
            } catch (Exception ignored) {
                // fall through to the failure below
            }
        }

        log.error("Failed to parse AI question draft response; excerpt: {}",
                cleaned.length() > 200 ? cleaned.substring(0, 200) : cleaned);
        throw new InvalidAiGeneratedQuestionException(
                "The AI returned malformed question draft JSON. Please try again.");
    }

    /**
     * Scans from the array opening bracket tracking brace depth and string
     * state, and returns the array cut after the last complete top-level
     * object. Returns null when no complete object exists.
     */
    private String salvageTruncatedArray(String text, int arrayStart) {
        int depth = 0;
        boolean inString = false;
        boolean escaped = false;
        int lastCompleteObjectEnd = -1;

        for (int i = arrayStart + 1; i < text.length(); i++) {
            char c = text.charAt(i);
            if (escaped) {
                escaped = false;
                continue;
            }
            if (c == '\\') {
                escaped = inString;
                continue;
            }
            if (c == '"') {
                inString = !inString;
                continue;
            }
            if (inString) continue;
            if (c == '{') depth++;
            else if (c == '}') {
                depth--;
                if (depth == 0) lastCompleteObjectEnd = i;
            }
        }

        if (lastCompleteObjectEnd < 0) return null;
        return text.substring(arrayStart, lastCompleteObjectEnd + 1) + "]";
    }

    /**
     * Parses the candidate as a JSON array, mapping each element
     * independently so one malformed question cannot fail the whole batch.
     * Returns null when the candidate is not a parseable non-empty array.
     */
    private List<GeneratedQuestionDraftDto> tryParseArray(String candidate) {
        JsonNode root;
        try {
            root = objectMapper.readTree(candidate);
        } catch (Exception e) {
            return null;
        }
        if (root == null || !root.isArray() || root.isEmpty()) {
            return null;
        }

        List<GeneratedQuestionDraftDto> drafts = new java.util.ArrayList<>();
        int skipped = 0;
        for (JsonNode element : root) {
            try {
                GeneratedQuestionDraftDto draft = draftMapper.treeToValue(
                        normalizeDraftNode(element), GeneratedQuestionDraftDto.class);
                if (draft != null && draft.question() != null && !draft.question().isBlank()) {
                    drafts.add(draft);
                } else {
                    skipped++;
                }
            } catch (Exception itemError) {
                skipped++;
                log.warn("Skipping unmappable question draft element ({}): {}",
                        itemError.getMessage(),
                        element.toString().length() > 180
                                ? element.toString().substring(0, 180)
                                : element.toString());
            }
        }
        if (skipped > 0) {
            log.warn("Skipped {} malformed question draft element(s); kept {}", skipped, drafts.size());
        }
        return drafts.isEmpty() ? null : drafts;
    }

    /**
     * Drafts are editable suggestions, so a missing lesson mapping is
     * repaired rather than discarded: match the suggested title against the
     * certification's real lessons, otherwise distribute round-robin, and
     * tell the admin to review the assignment.
     */
    private List<GeneratedQuestionDraftDto> assignMissingLessons(
            List<GeneratedQuestionDraftDto> drafts, CertContext ctx, List<String> warnings) {
        List<LessonRef> lessons = new ArrayList<>(ctx.lessonsById().values());
        if (lessons.isEmpty()) return drafts;

        boolean repaired = false;
        List<GeneratedQuestionDraftDto> result = new ArrayList<>(drafts.size());
        int roundRobin = 0;
        for (GeneratedQuestionDraftDto draft : drafts) {
            boolean validLesson = draft.suggestedLessonId() != null
                    && ctx.lessonsById().containsKey(draft.suggestedLessonId());
            if (validLesson) {
                result.add(draft);
                continue;
            }

            LessonRef assigned = null;
            String suggestedTitle = draft.suggestedLessonTitle();
            if (suggestedTitle != null && !suggestedTitle.isBlank()) {
                String needle = suggestedTitle.toLowerCase(Locale.ROOT);
                assigned = lessons.stream()
                        .filter(lesson -> lesson.title() != null
                                && lesson.title().toLowerCase(Locale.ROOT).contains(needle))
                        .findFirst()
                        .orElse(null);
            }
            if (assigned == null) {
                assigned = lessons.get(roundRobin++ % lessons.size());
            }
            repaired = true;
            result.add(new GeneratedQuestionDraftDto(
                    draft.questionType(),
                    assigned.lessonId(),
                    assigned.title(),
                    draft.question(),
                    draft.difficulty(),
                    draft.choices(),
                    draft.correctChoiceIndex(),
                    draft.correctAnswer(),
                    draft.checkingMethod(),
                    draft.rubricBasedAnswer(),
                    draft.starterCode(),
                    draft.testCases(),
                    draft.diagramType(),
                    draft.instructions(),
                    draft.authoringNotes()
            ));
        }
        if (repaired) {
            warnings.add("Some lesson assignments were suggested automatically. "
                    + "Review each question's lesson before saving.");
        }
        return result;
    }

    /**
     * Rewrites common alternate AI output shapes into the canonical
     * GeneratedQuestionDraftDto schema before mapping: key synonyms
     * (type/question_type, difficultyLevel/level, answer/correct_answer),
     * bare-string "options" arrays, and difficulty/type synonyms.
     */
    private JsonNode normalizeDraftNode(JsonNode element) {
        if (!element.isObject()) return element;
        com.fasterxml.jackson.databind.node.ObjectNode node =
                ((com.fasterxml.jackson.databind.node.ObjectNode) element).deepCopy();

        // question text synonyms
        renameFirst(node, "question", "questionText", "prompt");

        // correct answer synonyms
        renameFirst(node, "correctAnswer", "answer", "correct_answer", "expectedAnswer",
                "sampleAnswer", "modelAnswer", "referenceAnswer");
        boolean hadCanonicalCorrectChoiceIndex = node.hasNonNull("correctChoiceIndex");
        renameFirst(node, "correctChoiceIndex", "correctIndex", "answerIndex",
                "correctOptionIndex", "correct_choice_index");
        canonicalizeCorrectChoiceIndex(node, !hadCanonicalCorrectChoiceIndex);

        // question type synonyms and normalization
        renameFirst(node, "questionType", "type", "question_type");
        String type = node.path("questionType").asText("").trim().toUpperCase(Locale.ROOT)
                .replace(' ', '_').replace('-', '_');
        type = type.replaceAll("(_)?QUESTION$", "");
        type = switch (type) {
            case "MULTIPLE_CHOICE", "MULTIPLECHOICE", "MC" -> "MCQ";
            case "CODING", "CODE" -> "PROGRAMMING";
            case "ESSAY" -> "DESCRIPTIVE";
            case "SHORTANSWER" -> "SHORT_ANSWER";
            default -> type;
        };

        // choices: accept "options" (strings or objects) as well as "choices"
        JsonNode rawChoices = node.hasNonNull("choices") ? node.get("choices") : node.get("options");
        if (type.isBlank()) {
            if (rawChoices != null && rawChoices.isArray() && rawChoices.size() > 0) {
                type = "MCQ";
            } else if (node.hasNonNull("correctAnswer")
                    && !node.path("correctAnswer").asText("").isBlank()) {
                type = "SHORT_ANSWER";
            }
        }
        node.remove("options");
        if (rawChoices != null && rawChoices.isArray() && rawChoices.size() > 0) {
            String correctAnswerText = node.path("correctAnswer").asText("");
            int correctIndex = node.path("correctChoiceIndex").asInt(-1);
            com.fasterxml.jackson.databind.node.ArrayNode choices = objectMapper.createArrayNode();
            int index = 0;
            for (JsonNode choice : rawChoices) {
                com.fasterxml.jackson.databind.node.ObjectNode mapped = objectMapper.createObjectNode();
                if (choice.isObject()) {
                    String text = choice.path("choiceText").asText(
                            choice.path("text").asText(choice.path("option").asText("")));
                    mapped.put("choiceText", text);
                    if (choice.has("explanation")) {
                        mapped.set("explanation", choice.get("explanation"));
                    }
                    boolean correct = choice.path("isCorrect").asBoolean(
                            choice.path("correct").asBoolean(
                                    choice.path("is_correct").asBoolean(false)));
                    if (!correct && !correctAnswerText.isBlank()) {
                        correct = text.equalsIgnoreCase(correctAnswerText)
                                || java.util.Objects.equals(
                                        choice.path("label").asText(""),
                                        correctAnswerText);
                    }
                    mapped.put("isCorrect", correct || index == correctIndex);
                    if (correct) correctIndex = index;
                } else {
                    String text = choice.asText("");
                    boolean correct = index == correctIndex
                            || (!correctAnswerText.isBlank()
                                    && text.equalsIgnoreCase(correctAnswerText));
                    mapped.put("choiceText", text);
                    mapped.put("isCorrect", correct);
                    if (correct) correctIndex = index;
                }
                choices.add(mapped);
                index++;
            }
            node.set("choices", choices);
            if (correctIndex >= 0) {
                node.put("correctChoiceIndex", correctIndex);
                // The MCQ validator also requires a non-blank correctAnswer;
                // backfill it from the correct choice when the model omitted it.
                if (!node.hasNonNull("correctAnswer")
                        || node.path("correctAnswer").asText("").isBlank()) {
                    node.put("correctAnswer",
                            choices.get(correctIndex).path("choiceText").asText(""));
                }
            }
            if (type.isBlank()) type = "MCQ";
        }
        if (!type.isBlank()) node.put("questionType", type);

        // Per-type field normalization: force the checking method the
        // validator requires and map answer/config synonyms so more drafts
        // survive validation.
        switch (type) {
            case "SHORT_ANSWER" -> {
                renameFirst(node, "correctAnswer",
                        "answer", "expectedAnswer", "sampleAnswer", "modelAnswer", "expectedOutput");
                if (node.path("correctAnswer").asText("").isBlank()) {
                    node.put("correctAnswer", "TODO: add correct answer before saving");
                }
                node.put("checkingMethod", "EXACT_MATCH");
                // Optional exact-match alternatives (e.g. "SQL" / "Structured Query Language").
                renameFirst(node, "acceptedVariations",
                        "accepted_answers", "acceptedAnswers", "answerVariations",
                        "variations", "alternateAnswers", "synonyms", "aliases");
                coerceStringArray(node, "acceptedVariations");
            }
            case "DESCRIPTIVE" -> {
                renameFirst(node, "rubricBasedAnswer",
                        "rubric", "sampleAnswer", "modelAnswer", "referenceAnswer",
                        "correctAnswer", "answer", "expectedAnswer");
                node.put("checkingMethod", "AI_SEMANTIC");
            }
            case "PROGRAMMING" -> {
                renameFirst(node, "testCases", "tests", "test_cases", "sampleTests");
                renameFirst(node, "starterCode", "starter_code", "template", "boilerplate");
                com.fasterxml.jackson.databind.node.ArrayNode mappedTests =
                        objectMapper.createArrayNode();
                JsonNode tests = node.get("testCases");
                if (tests != null && tests.isArray()) {
                    for (JsonNode test : tests) {
                        if (!test.isObject()) continue;
                        String expected = test.path("expectedOutput").asText(
                                test.path("output").asText(test.path("expected").asText("")));
                        if (expected.isBlank()) continue;
                        com.fasterxml.jackson.databind.node.ObjectNode mapped =
                                objectMapper.createObjectNode();
                        mapped.put("inputData", test.path("inputData").asText(
                                test.path("input").asText(test.path("in").asText(""))));
                        mapped.put("expectedOutput", expected);
                        mappedTests.add(mapped);
                    }
                }
                // Drafts are admin-completed and there is no code execution, so
                // seed one clearly-marked placeholder test case the author fills in.
                if (mappedTests.isEmpty()) {
                    com.fasterxml.jackson.databind.node.ObjectNode placeholder =
                            objectMapper.createObjectNode();
                    placeholder.put("inputData", "");
                    placeholder.put("expectedOutput", "TODO: add expected output before saving");
                    mappedTests.add(placeholder);
                }
                node.set("testCases", mappedTests);
            }
            case "DIAGRAM" -> {
                renameFirst(node, "diagramType", "diagram_type");
                renameFirst(node, "instructions", "instruction", "task", "requirements");
                renameFirst(node, "authoringNotes",
                        "authoring_notes", "notes", "referenceNotes", "solutionNotes");
                String diagramType = node.path("diagramType").asText("").trim()
                        .toUpperCase(Locale.ROOT).replace(' ', '_').replace('-', '_');
                diagramType = switch (diagramType) {
                    case "UML", "CLASS", "CLASS_DIAGRAM", "UMLCLASS" -> "UML_CLASS";
                    case "SEQUENCE", "SEQUENCE_DIAGRAM", "UMLSEQUENCE" -> "UML_SEQUENCE";
                    case "ENTITY_RELATIONSHIP", "ENTITY_RELATIONSHIP_DIAGRAM" -> "ERD";
                    case "DATA_FLOW", "DATA_FLOW_DIAGRAM", "DATAFLOW" -> "DFD";
                    case "FLOW_CHART" -> "FLOWCHART";
                    case "MINDMAP", "MIND_MAPPING" -> "MIND_MAP";
                    case "NETWORK", "NETWORK_TOPOLOGY", "NETWORK_DIAGRAM_TYPE" -> "NETWORK_DIAGRAM";
                    default -> diagramType;
                };
                // Infer the diagram type from the prompt when the model omits it.
                if (diagramType.isBlank() || !DIAGRAM_TYPES.contains(diagramType)) {
                    String q = node.path("question").asText("").toLowerCase(Locale.ROOT);
                    if (q.contains("erd") || q.contains("entity") || q.contains("relationship")
                            || q.contains("schema")) {
                        diagramType = "ERD";
                    } else if (q.contains("sequence")) {
                        diagramType = "UML_SEQUENCE";
                    } else if (q.contains("uml") || q.contains("class")) {
                        diagramType = "UML_CLASS";
                    } else if (q.contains("data flow") || q.contains("dfd")) {
                        diagramType = "DFD";
                    } else if (q.contains("mind map") || q.contains("mindmap")) {
                        diagramType = "MIND_MAP";
                    } else if (q.contains("network") || q.contains("topology")) {
                        diagramType = "NETWORK_DIAGRAM";
                    } else {
                        diagramType = "FLOWCHART";
                    }
                }
                node.put("diagramType", diagramType);
                if (node.path("instructions").asText("").isBlank()) {
                    node.put("instructions", node.path("question").asText(
                            "Create the requested diagram."));
                }
                if (node.path("authoringNotes").asText("").isBlank()) {
                    node.put("authoringNotes",
                            "Create the reference diagram manually and review before saving.");
                }
                // Diagram reference data is admin-controlled only.
                node.remove("referenceDiagramXml");
                node.remove("referenceDiagramNodes");
                node.remove("referenceDiagramEdges");
            }
            default -> { /* MCQ handled above */ }
        }

        // difficulty synonyms and normalization
        renameFirst(node, "difficulty", "difficultyLevel", "level");
        String difficulty = node.path("difficulty").asText("").trim().toLowerCase(Locale.ROOT);
        difficulty = switch (difficulty) {
            case "beginner", "basic", "easy" -> "easy";
            case "avg", "medium", "moderate", "intermediate", "average", "" -> "average";
            case "difficult", "advanced", "expert", "hard" -> "hard";
            default -> "average";
        };
        node.put("difficulty", difficulty);

        renameFirst(node, "suggestedLessonId", "lessonId");
        renameFirst(node, "suggestedLessonTitle", "lessonTitle");
        return node;
    }

    private void canonicalizeCorrectChoiceIndex(
            com.fasterxml.jackson.databind.node.ObjectNode node,
            boolean allowOneBasedIndex
    ) {
        JsonNode value = node.get("correctChoiceIndex");
        if (value == null || value.isNull()) return;

        Integer index = null;
        boolean numericIndex = false;
        if (value.isNumber()) {
            index = value.asInt();
            numericIndex = true;
        } else if (value.isTextual()) {
            String text = value.asText("").trim();
            if (text.matches("\\d+")) {
                index = Integer.parseInt(text);
                numericIndex = true;
            } else if (text.length() == 1) {
                char letter = Character.toUpperCase(text.charAt(0));
                if (letter >= 'A' && letter <= 'D') {
                    index = letter - 'A';
                }
            }
        }

        if (index == null) return;

        JsonNode rawChoices = node.hasNonNull("choices") ? node.get("choices") : node.get("options");
        if (numericIndex && rawChoices != null && rawChoices.isArray()
                && (index == rawChoices.size()
                        || (allowOneBasedIndex && index >= 1 && index <= rawChoices.size()))) {
            index--;
        }
        node.put("correctChoiceIndex", index);
    }

    /**
     * Normalizes {@code field} to a JSON array of non-blank strings: a single
     * string becomes a one-element array; a missing/blank/other value is removed
     * so it deserializes to null rather than a malformed list.
     */
    private void coerceStringArray(
            com.fasterxml.jackson.databind.node.ObjectNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) {
            node.remove(field);
            return;
        }
        if (value.isArray()) {
            com.fasterxml.jackson.databind.node.ArrayNode cleaned = objectMapper.createArrayNode();
            for (JsonNode element : value) {
                String text = element.isTextual() ? element.asText() : element.toString();
                if (text != null && !text.isBlank()) {
                    cleaned.add(text.trim());
                }
            }
            if (cleaned.isEmpty()) {
                node.remove(field);
            } else {
                node.set(field, cleaned);
            }
            return;
        }
        if (value.isTextual() && !value.asText().isBlank()) {
            com.fasterxml.jackson.databind.node.ArrayNode arr = objectMapper.createArrayNode();
            arr.add(value.asText().trim());
            node.set(field, arr);
        } else {
            node.remove(field);
        }
    }

    private void renameFirst(
            com.fasterxml.jackson.databind.node.ObjectNode node,
            String canonical, String... synonyms) {
        if (node.hasNonNull(canonical)) return;
        for (String synonym : synonyms) {
            if (node.hasNonNull(synonym)) {
                node.set(canonical, node.get(synonym));
                node.remove(synonym);
                return;
            }
        }
    }
}

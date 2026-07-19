package com.capstone.rebyu.ai.service;

import com.capstone.rebyu.ai.assistant.LessonGenerationAssistant;
import com.capstone.rebyu.ai.collector.LessonDraftCollector;
import com.capstone.rebyu.ai.context.LessonGenerationExecutionContext;
import com.capstone.rebyu.ai.context.LessonGenerationExecutionContext.SourceChunk;
import com.capstone.rebyu.ai.dto.GeneratedLessonSectionDraftDto;
import com.capstone.rebyu.ai.dto.GeneratedLessonToolDraftDto;
import com.capstone.rebyu.ai.dto.LessonGenerationDraftResponseDto;
import com.capstone.rebyu.ai.dto.LessonGenerationDraftResponseDto.LessonGenerationAnalysisDto;
import com.capstone.rebyu.ai.dto.lesson.data.ImageFeatureGridToolDataDto;
import com.capstone.rebyu.ai.dto.lesson.data.ImageLeftTextToolDataDto;
import com.capstone.rebyu.ai.dto.lesson.data.ImageRightTextToolDataDto;
import com.capstone.rebyu.ai.dto.lesson.data.ImageToolDataDto;
import com.capstone.rebyu.ai.dto.lesson.data.IntroImageCardToolDataDto;
import com.capstone.rebyu.ai.dto.lesson.data.MediaTextBlockToolDataDto;
import com.capstone.rebyu.ai.dto.lesson.data.VideoToolDataDto;
import com.capstone.rebyu.ai.entity.KnowledgeDocument;
import com.capstone.rebyu.ai.entity.KnowledgeDocumentImage;
import com.capstone.rebyu.ai.repository.KnowledgeDocumentImageRepository;
import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.certification.entity.MajorCategory;
import com.capstone.rebyu.certification.entity.MiddleCategory;
import com.capstone.rebyu.certification.repository.LessonRepository;
import com.capstone.rebyu.common.InvalidAiResponseException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.ImageContent;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.TextContent;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.rag.content.retriever.ContentRetriever;
import dev.langchain4j.rag.query.Query;
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
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
public class LessonGenerationService {

    private static final int MAX_DOC_CHARS = 10_000;
    private static final int MAX_CHUNK_CHARS = 2_500;
    // Caps vision-model token/cost per request; the highest-similarity
    // chunks are searched first, so the first N distinct linked images are
    // already the most relevant ones.
    private static final int MAX_IMAGES_PER_REQUEST = 6;

    record LessonContext(Long lessonId, String lessonTitle, String middleTitle,
                         String majorTitle, String certTitle, Long certId) {}

    /** One retrieved chunk with the image keys linked to it (see DocumentIngestionService), if any. */
    private record RetrievedChunk(String text, Set<String> imageKeys) {}

    /** One image resolved and ready to attach to a multimodal prompt, with its trusted imageKey. */
    private record AvailableImage(String imageKey, String contentType, String base64Data, String caption) {}

    private final LessonRepository lessonRepository;
    private final DocumentIngestionService documentIngestionService;
    private final LessonGenerationAssistant lessonGenerationAssistant;
    private final ContentRetriever lessonContentRetriever;
    private final AiUploadValidator aiUploadValidator;
    private final LessonToolDraftValidator lessonToolDraftValidator;
    private final LessonDraftCollector lessonDraftCollector;
    private final LessonGenerationExecutionContext generationExecutionContext;
    private final LessonDraftJsonParser lessonDraftJsonParser;
    private final ObjectMapper objectMapper;
    private final KnowledgeDocumentImageRepository knowledgeDocumentImageRepository;
    private final QuestionSourceImageService questionSourceImageService;
    // Used only for the manual multimodal call (retrieval-linked images); the
    // existing text-only lessonGenerationAssistant path is untouched.
    private final ChatModel chatModel;

    // Self-proxy so @Transactional on loadLessonContext is honored (a direct
    // call would be self-invocation and bypass the transaction).
    @org.springframework.beans.factory.annotation.Autowired
    @org.springframework.context.annotation.Lazy
    private LessonGenerationService self;

    public LessonGenerationService(
            LessonRepository lessonRepository,
            DocumentIngestionService documentIngestionService,
            LessonGenerationAssistant lessonGenerationAssistant,
            @Qualifier("lessonContentRetriever") ContentRetriever lessonContentRetriever,
            AiUploadValidator aiUploadValidator,
            LessonToolDraftValidator lessonToolDraftValidator,
            LessonDraftCollector lessonDraftCollector,
            LessonGenerationExecutionContext generationExecutionContext,
            LessonDraftJsonParser lessonDraftJsonParser,
            ObjectMapper objectMapper,
            KnowledgeDocumentImageRepository knowledgeDocumentImageRepository,
            QuestionSourceImageService questionSourceImageService,
            ChatModel chatModel
    ) {
        this.lessonRepository = lessonRepository;
        this.documentIngestionService = documentIngestionService;
        this.lessonGenerationAssistant = lessonGenerationAssistant;
        this.lessonContentRetriever = lessonContentRetriever;
        this.aiUploadValidator = aiUploadValidator;
        this.lessonToolDraftValidator = lessonToolDraftValidator;
        this.lessonDraftCollector = lessonDraftCollector;
        this.generationExecutionContext = generationExecutionContext;
        this.lessonDraftJsonParser = lessonDraftJsonParser;
        this.objectMapper = objectMapper;
        this.knowledgeDocumentImageRepository = knowledgeDocumentImageRepository;
        this.questionSourceImageService = questionSourceImageService;
        this.chatModel = chatModel;
    }

    public LessonGenerationDraftResponseDto generateDrafts(
            Long lessonId,
            List<MultipartFile> files,
            String additionalInstructions
    ) throws IOException {
        // Uploaded files are optional: with none, the lesson is generated from
        // the certification's indexed knowledge (embeddings) alone, the same
        // way question generation already supports a file-less mode.
        List<MultipartFile> uploadedFiles = files == null
                ? List.of()
                : files.stream().filter(file -> file != null && !file.isEmpty()).toList();

        if (!uploadedFiles.isEmpty()) {
            aiUploadValidator.validate(uploadedFiles);
        }

        LessonContext ctx = self.loadLessonContext(lessonId);
        List<String> warnings = new ArrayList<>();

        StringBuilder rawText = new StringBuilder();
        for (MultipartFile file : uploadedFiles) {
            rawText.append(documentIngestionService.extractDocumentText(file)).append("\n\n");
            documentIngestionService.ingest(file, ctx.certId(), KnowledgeDocument.UseCase.LESSON);
        }
        if (!uploadedFiles.isEmpty()) {
            aiUploadValidator.requireReadableText(rawText.toString());
        }

        List<RetrievedChunk> retrievedChunks = retrieveRelatedChunks(ctx);
        List<SourceChunk> sourceChunks = buildSourceChunks(rawText.toString(), retrievedChunks);

        if (sourceChunks.isEmpty()) {
            throw new IllegalArgumentException(
                    "No source material is available for this lesson. Upload a document, "
                            + "or add and index certification knowledge first.");
        }

        // Images linked to the matched chunks (nearest-match first) —
        // retrieved together with their text, never stored inside the
        // embedding itself.
        Set<String> retrievedImageKeys = new LinkedHashSet<>();
        for (SourceChunk chunk : sourceChunks) {
            retrievedImageKeys.addAll(chunk.imageKeys());
        }
        List<AvailableImage> availableImages = resolveAvailableImages(retrievedImageKeys);

        lessonDraftCollector.clear();
        generationExecutionContext.clear();
        generationExecutionContext.initialize(sourceChunks);

        Map<String, Object> requestData = new LinkedHashMap<>();
        requestData.put("lessonId", ctx.lessonId());
        requestData.put("lessonTitle", ctx.lessonTitle());
        requestData.put("middleCategoryTitle", ctx.middleTitle());
        requestData.put("majorCategoryTitle", ctx.majorTitle());
        requestData.put("certificationTitle", ctx.certTitle());
        requestData.put("availableSourceChunks", sourceChunks.stream()
                .map(chunk -> Map.of("sourceChunkId", chunk.id()))
                .toList());
        if (additionalInstructions != null && !additionalInstructions.isBlank()) {
            requestData.put("additionalInstructions", additionalInstructions);
        }
        String requestJson = objectMapper.writeValueAsString(requestData);
        String referenceContext = generationExecutionContext.formatForPrompt();

        log.info("Generating lesson draft for lessonId={} ({}) images={}",
                lessonId, ctx.lessonTitle(), availableImages.size());

        List<GeneratedLessonSectionDraftDto> sections = null;
        for (int attempt = 1; attempt <= 2 && (sections == null || sections.isEmpty()); attempt++) {
            String raw = availableImages.isEmpty()
                    ? lessonGenerationAssistant.generateLessonDraft(requestJson, referenceContext)
                    : generateLessonDraftWithImages(requestJson, referenceContext, availableImages);
            sections = lessonDraftJsonParser.parseSections(raw, warnings);
            if (sections.isEmpty()) {
                log.warn("Attempt {}/2 produced no lesson sections for lessonId={}; raw excerpt: {}",
                        attempt, lessonId,
                        raw == null ? "null"
                                : raw.substring(0, Math.min(raw.length(), 500)));
            }
        }
        if (sections == null || sections.isEmpty()) {
            throw new InvalidAiResponseException("The AI did not create any lesson sections.");
        }

        // Only imageKeys actually resolved from linked certification images
        // are trusted; anything else the AI returns is stripped. No
        // video-linking infrastructure exists, so videoKey is always cleared.
        Set<String> trustedImageKeys = new HashSet<>();
        availableImages.forEach(image -> trustedImageKeys.add(image.imageKey()));
        sections = sanitizeMediaKeys(sections, trustedImageKeys);

        lessonToolDraftValidator.validateCollectedDrafts(sections);

        int toolCount = sections.stream()
                .mapToInt(section -> section.content() == null ? 0 : section.content().size())
                .sum();

        log.info("Generated lesson draft for lessonId={} with {} sections and {} tools",
                lessonId, sections.size(), toolCount);

        return new LessonGenerationDraftResponseDto(
                sections,
                new LessonGenerationAnalysisDto(
                        ctx.lessonId(),
                        ctx.lessonTitle(),
                        sections.size(),
                        toolCount,
                        sourceChunks.size(),
                        uploadedFiles.size()
                ),
                List.copyOf(warnings)
        );
    }

    @Transactional(readOnly = true)
    public LessonContext loadLessonContext(Long lessonId) {
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new EntityNotFoundException("Lesson not found: " + lessonId));

        MiddleCategory mid = lesson.getMiddleCategory();
        MajorCategory major = mid.getMajorCategory();
        String certTitle = major.getCertification() != null ? major.getCertification().getTitle() : "";
        Long certId = major.getCertification() != null ? major.getCertification().getCertificationId() : null;

        return new LessonContext(lesson.getLessonId(), lesson.getName(),
                mid.getTitle(), major.getTitle(), certTitle, certId);
    }

    private List<RetrievedChunk> retrieveRelatedChunks(LessonContext ctx) {
        String queryText = String.join(" ", ctx.certTitle(), ctx.majorTitle(), ctx.middleTitle(), ctx.lessonTitle());
        try {
            List<dev.langchain4j.rag.content.Content> contents =
                    lessonContentRetriever.retrieve(Query.from(queryText));
            return contents.stream()
                    .map(c -> {
                        String imageKeysCsv = c.textSegment().metadata().getString("imageKeys");
                        Set<String> imageKeys = imageKeysCsv == null || imageKeysCsv.isBlank()
                                ? Set.<String>of()
                                : Set.of(imageKeysCsv.split(","));
                        return new RetrievedChunk(c.textSegment().text(), imageKeys);
                    })
                    .toList();
        } catch (Exception e) {
            log.warn("Reference retrieval failed for lessonId={}: {}", ctx.lessonId(), e.getMessage());
            return List.of();
        }
    }

    private List<SourceChunk> buildSourceChunks(String extractedText, List<RetrievedChunk> retrievedChunks) {
        List<SourceChunk> chunks = new ArrayList<>();
        int chunkIndex = 1;

        String documentText = extractedText.length() > MAX_DOC_CHARS
                ? extractedText.substring(0, MAX_DOC_CHARS)
                : extractedText;

        for (String part : splitIntoChunks(documentText)) {
            if (!part.isBlank()) {
                chunks.add(new SourceChunk("chunk-" + chunkIndex++, part.trim()));
            }
        }

        for (RetrievedChunk retrieved : retrievedChunks) {
            if (retrieved.text() == null || retrieved.text().isBlank()) continue;
            for (String part : splitIntoChunks(retrieved.text())) {
                if (!part.isBlank()) {
                    chunks.add(new SourceChunk("chunk-" + chunkIndex++, part.trim(), retrieved.imageKeys()));
                }
            }
        }

        return chunks;
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
                log.warn("Could not load linked image '{}' for lesson generation: {}",
                        image.getImageKey(), e.getMessage());
            }
        }
        return available;
    }

    /**
     * Vision-capable call path used only when retrieval linked real images
     * to the matched chunks. Bypasses the declarative
     * {@code LessonGenerationAssistant} (its {@code @UserMessage} templating
     * is text-only) and calls {@code ChatModel} directly with a manually-built
     * multimodal message, reusing the SAME system prompt
     * ({@link LessonGenerationAssistant#SYSTEM_PROMPT}) so output format and
     * tool-coverage rules stay identical to the text-only path. Each image is
     * preceded by a "imageId: ..." text part so the model can correlate what
     * it sees with the trusted key it must copy back.
     */
    private String generateLessonDraftWithImages(
            String requestJson, String referenceContext, List<AvailableImage> availableImages) {
        List<dev.langchain4j.data.message.Content> userContents = new ArrayList<>();

        StringBuilder catalog = new StringBuilder();
        catalog.append("AVAILABLE IMAGES — each one below is shown to you with its trusted imageId. ")
                .append("Choose an imageId ONLY if that exact image is genuinely relevant to a specific ")
                .append("tool's content; copy it EXACTLY into that tool's imageKey field. ")
                .append("Never invent an imageId, never guess one that was not shown, and leave imageKey ")
                .append("blank when none of these images is relevant to a given tool.\n");
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
                Generate a complete editable lesson draft as a JSON array of sections.

                Lesson request:
                %s

                Reference context:
                %s

                Return only the JSON array of sections.
                """.formatted(requestJson, referenceContext)));

        List<ChatMessage> messages = List.of(
                SystemMessage.from(LessonGenerationAssistant.SYSTEM_PROMPT),
                UserMessage.from(userContents));
        return chatModel.chat(messages).aiMessage().text();
    }

    /**
     * Strips any imageKey the AI returned that isn't in the trusted set
     * resolved from retrieval-linked images, and always clears videoKey
     * (no video-linking infrastructure exists). Runs before validation so
     * an invented or unrelated key never reaches the collector.
     */
    private List<GeneratedLessonSectionDraftDto> sanitizeMediaKeys(
            List<GeneratedLessonSectionDraftDto> sections, Set<String> trustedImageKeys) {
        return sections.stream().map(section -> new GeneratedLessonSectionDraftDto(
                section.id(), section.sectionName(),
                section.content() == null ? null : section.content().stream()
                        .map(tool -> sanitizeTool(tool, trustedImageKeys))
                        .toList()
        )).toList();
    }

    private GeneratedLessonToolDraftDto sanitizeTool(GeneratedLessonToolDraftDto tool, Set<String> trustedImageKeys) {
        if (tool == null || tool.data() == null) {
            return tool;
        }
        Object data = switch (tool.type()) {
            case "image" -> {
                var d = (ImageToolDataDto) tool.data();
                yield new ImageToolDataDto(d.file(), sanitizedImageKey(d.imageKey(), trustedImageKeys));
            }
            case "video" -> {
                var d = (VideoToolDataDto) tool.data();
                yield new VideoToolDataDto(d.file(), "");
            }
            case "image-left-text" -> {
                var d = (ImageLeftTextToolDataDto) tool.data();
                yield new ImageLeftTextToolDataDto(
                        d.file(), sanitizedImageKey(d.imageKey(), trustedImageKeys), d.title(), d.description());
            }
            case "image-right-text" -> {
                var d = (ImageRightTextToolDataDto) tool.data();
                yield new ImageRightTextToolDataDto(
                        d.file(), sanitizedImageKey(d.imageKey(), trustedImageKeys), d.title(), d.description());
            }
            case "intro-image-card" -> {
                var d = (IntroImageCardToolDataDto) tool.data();
                yield new IntroImageCardToolDataDto(
                        d.smallHeader(), d.description(), d.file(),
                        sanitizedImageKey(d.imageKey(), trustedImageKeys));
            }
            case "image-feature-grid" -> {
                var d = (ImageFeatureGridToolDataDto) tool.data();
                yield new ImageFeatureGridToolDataDto(
                        d.smallHeader(), d.description(), d.file(),
                        sanitizedImageKey(d.imageKey(), trustedImageKeys), d.gridItems());
            }
            case "media-text-block" -> {
                var d = (MediaTextBlockToolDataDto) tool.data();
                yield new MediaTextBlockToolDataDto(
                        d.smallHeader(), d.description(), d.mediaType(), d.file(),
                        sanitizedImageKey(d.imageKey(), trustedImageKeys), "",
                        d.supportingTitle(), d.supportingDescription(), d.layout());
            }
            default -> tool.data();
        };
        return new GeneratedLessonToolDraftDto(tool.id(), tool.type(), data, tool.authoringNotes());
    }

    private String sanitizedImageKey(String imageKey, Set<String> trustedImageKeys) {
        return imageKey != null && trustedImageKeys.contains(imageKey) ? imageKey : "";
    }

    private List<String> splitIntoChunks(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }

        List<String> chunks = new ArrayList<>();
        String remaining = text.trim();

        while (!remaining.isEmpty()) {
            if (remaining.length() <= MAX_CHUNK_CHARS) {
                chunks.add(remaining);
                break;
            }

            int splitAt = findSplitPoint(remaining, MAX_CHUNK_CHARS);
            chunks.add(remaining.substring(0, splitAt).trim());
            remaining = remaining.substring(splitAt).trim();
        }

        return chunks;
    }

    private int findSplitPoint(String text, int maxLength) {
        int preferred = Math.min(maxLength, text.length());
        int paragraphBreak = text.lastIndexOf("\n\n", preferred);
        if (paragraphBreak >= preferred / 2) {
            return paragraphBreak;
        }

        int sentenceBreak = Math.max(
                text.lastIndexOf(". ", preferred),
                Math.max(text.lastIndexOf("! ", preferred), text.lastIndexOf("? ", preferred))
        );
        if (sentenceBreak >= preferred / 2) {
            return sentenceBreak + 1;
        }

        int spaceBreak = text.lastIndexOf(' ', preferred);
        if (spaceBreak >= preferred / 2) {
            return spaceBreak;
        }

        return preferred;
    }
}

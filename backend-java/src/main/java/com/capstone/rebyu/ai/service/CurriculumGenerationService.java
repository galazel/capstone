package com.capstone.rebyu.ai.service;

import com.capstone.rebyu.ai.assistant.CurriculumPlanningAssistant;
import com.capstone.rebyu.ai.assistant.LessonGenerationAssistant;
import com.capstone.rebyu.ai.collector.LessonDraftCollector;
import com.capstone.rebyu.ai.dto.GeneratedLessonSectionDraftDto;
import com.capstone.rebyu.ai.dto.GeneratedLessonToolDraftDto;
import com.capstone.rebyu.ai.dto.CurriculumLessonDTO;
import com.capstone.rebyu.ai.dto.CurriculumMajorCategoryDTO;
import com.capstone.rebyu.ai.dto.CurriculumMiddleCategoryDTO;
import com.capstone.rebyu.ai.dto.CurriculumPlanDTO;
import com.capstone.rebyu.ai.entity.KnowledgeDocument;
import com.capstone.rebyu.certification.dto.CertificationDto;
import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.certification.entity.MajorCategory;
import com.capstone.rebyu.certification.entity.MiddleCategory;
import com.capstone.rebyu.certification.mapper.CertificationMapper;
import com.capstone.rebyu.certification.repository.CertificationRepository;
import com.capstone.rebyu.certification.repository.LessonRepository;
import com.capstone.rebyu.certification.repository.MajorCategoryRepository;
import com.capstone.rebyu.certification.repository.MiddleCategoryRepository;
import com.capstone.rebyu.common.InvalidAiResponseException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.rag.content.Content;
import dev.langchain4j.rag.content.retriever.ContentRetriever;
import dev.langchain4j.rag.query.Query;
import jakarta.persistence.EntityNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
public class CurriculumGenerationService {

    private static final int MAX_DOC_CHARS = 10_000;

    record LessonCtx(Long lessonId, String lessonTitle, String midTitle, String majorTitle, String certTitle) {}

    private final CertificationRepository certificationRepository;
    private final MajorCategoryRepository majorCategoryRepository;
    private final MiddleCategoryRepository middleCategoryRepository;
    private final LessonRepository lessonRepository;
    private final DocumentIngestionService documentIngestionService;
    private final CurriculumPlanningAssistant curriculumPlanningAssistant;
    private final LessonGenerationAssistant lessonGenerationAssistant;
    private final ContentRetriever lessonContentRetriever;
    private final CertificationMapper certificationMapper;
    private final ObjectMapper objectMapper;
    private final LessonEmbeddingService lessonEmbeddingService;
    private final AiUploadValidator aiUploadValidator;
    private final LessonContentValidator lessonContentValidator;
    private final LessonDraftCollector lessonDraftCollector;

    @Autowired @Lazy
    private CurriculumGenerationService self;

    public CurriculumGenerationService(
            CertificationRepository certificationRepository,
            MajorCategoryRepository majorCategoryRepository,
            MiddleCategoryRepository middleCategoryRepository,
            LessonRepository lessonRepository,
            DocumentIngestionService documentIngestionService,
            CurriculumPlanningAssistant curriculumPlanningAssistant,
            LessonGenerationAssistant lessonGenerationAssistant,
            @Qualifier("lessonContentRetriever") ContentRetriever lessonContentRetriever,
            CertificationMapper certificationMapper,
            ObjectMapper objectMapper,
            LessonEmbeddingService lessonEmbeddingService,
            AiUploadValidator aiUploadValidator,
            LessonContentValidator lessonContentValidator,
            LessonDraftCollector lessonDraftCollector
    ) {
        this.certificationRepository = certificationRepository;
        this.majorCategoryRepository = majorCategoryRepository;
        this.middleCategoryRepository = middleCategoryRepository;
        this.lessonRepository = lessonRepository;
        this.documentIngestionService = documentIngestionService;
        this.curriculumPlanningAssistant = curriculumPlanningAssistant;
        this.lessonGenerationAssistant = lessonGenerationAssistant;
        this.lessonContentRetriever = lessonContentRetriever;
        this.certificationMapper = certificationMapper;
        this.objectMapper = objectMapper;
        this.lessonEmbeddingService = lessonEmbeddingService;
        this.aiUploadValidator = aiUploadValidator;
        this.lessonContentValidator = lessonContentValidator;
        this.lessonDraftCollector = lessonDraftCollector;
    }


    public CertificationDto generateForNewCertification(
            CertificationDto dto,
            List<MultipartFile> files,
            String additionalInstructions
    ) throws IOException {
        aiUploadValidator.validate(files);

        String documentContent = extractText(files);
        aiUploadValidator.requireReadableText(documentContent);

        CurriculumPlanDTO plan = planCurriculum(
                dto.getTitle(), dto.getDescription(), additionalInstructions, documentContent
        );

        Long certificationId = self.createCertificationWithPlan(dto, plan);
        log.info("Created certification {} with AI-generated structure", certificationId);

        // Ingest the source so each lesson can later be generated (and previewed)
        // from it. Lesson content itself is produced per lesson via the lesson
        // editor's generate-draft flow, so this stays fast and never times out.
        ingestFiles(files, certificationId);

        return self.fetchCertificationDto(certificationId);
    }

    public CertificationDto generateForExistingCertification(
            Long certificationId,
            List<MultipartFile> files,
            String additionalInstructions
    ) throws IOException {
        aiUploadValidator.validate(files);

        String certTitle = self.fetchCertificationTitle(certificationId);
        String certDescription = self.fetchCertificationDescription(certificationId);
        self.assertStructureReplaceable(certificationId);

        String documentContent = extractText(files);
        aiUploadValidator.requireReadableText(documentContent);

        CurriculumPlanDTO plan = planCurriculum(
                certTitle, certDescription, additionalInstructions, documentContent
        );

        self.replaceStructureWithPlan(certificationId, plan);
        log.info("Replaced structure of certification {} with AI-generated plan", certificationId);

        // Ingest the source for later per-lesson generation/preview; lesson
        // content is produced and reviewed one lesson at a time.
        ingestFiles(files, certificationId);

        return self.fetchCertificationDto(certificationId);
    }





    @Transactional(readOnly = true)
    public String fetchCertificationTitle(Long certificationId) {
        return certificationRepository.findById(certificationId)
                .map(Certification::getTitle)
                .orElseThrow(() -> new EntityNotFoundException("Certification not found: " + certificationId));
    }

    @Transactional(readOnly = true)
    public String fetchCertificationDescription(Long certificationId) {
        return certificationRepository.findById(certificationId)
                .map(Certification::getDescription)
                .orElse("");
    }






    @Transactional(readOnly = true)
    public void assertStructureReplaceable(Long certificationId) {
        List<Lesson> lessons = lessonRepository
                .findByMiddleCategory_MajorCategory_Certification_CertificationId(certificationId);

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
    public Long createCertificationWithPlan(CertificationDto dto, CurriculumPlanDTO plan) {
        Certification certification = certificationMapper.toEntity(dto);
        certification.setCertificationId(null);
        certification.setDateCreated(LocalDateTime.now());
        certification.setDateUpdated(null);


        if (certification.getMajorCategory() == null) {
            certification.setMajorCategory(new ArrayList<>());
        } else {
            certification.getMajorCategory().clear();
        }

        Certification saved = certificationRepository.save(certification);
        appendPlanStructure(saved, plan);
        return saved.getCertificationId();
    }

    @Transactional
    public void replaceStructureWithPlan(Long certificationId, CurriculumPlanDTO plan) {
        Certification cert = certificationRepository.findById(certificationId)
                .orElseThrow(() -> new EntityNotFoundException("Certification not found: " + certificationId));


        cert.getMajorCategory().clear();
        certificationRepository.saveAndFlush(cert);

        appendPlanStructure(cert, plan);
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
                .findByMiddleCategory_MajorCategory_Certification_CertificationId(certificationId)) {
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





    private void appendPlanStructure(Certification cert, CurriculumPlanDTO plan) {
        List<CurriculumMajorCategoryDTO> majorList = plan.getMajorCategories();

        for (CurriculumMajorCategoryDTO majorDto : majorList) {
            MajorCategory major = new MajorCategory();
            major.setCertification(cert);
            major.setTitle(majorDto.getTitle());
            major = majorCategoryRepository.save(major);

            if (majorDto.getMiddleCategories() == null) continue;
            List<CurriculumMiddleCategoryDTO> middleList = majorDto.getMiddleCategories();

            for (CurriculumMiddleCategoryDTO midDto : middleList) {
                MiddleCategory middle = new MiddleCategory();
                middle.setMajorCategory(major);
                middle.setTitle(midDto.getTitle());
                middle = middleCategoryRepository.save(middle);

                if (midDto.getLessons() == null) continue;
                List<CurriculumLessonDTO> lessonList = midDto.getLessons();

                for (CurriculumLessonDTO lessonDto : lessonList) {
                    Lesson lesson = new Lesson();
                    lesson.setMiddleCategory(middle);
                    lesson.setName(lessonDto.getTitle());
                    lesson.setLessonComponentStructure("[]");
                    lessonRepository.save(lesson);
                }
            }
        }
    }

    private CurriculumPlanDTO planCurriculum(
            String certTitle,
            String certDescription,
            String additionalInstructions,
            String documentContent
    ) throws IOException {
        Map<String, Object> planRequest = new LinkedHashMap<>();
        planRequest.put("certificationTitle", certTitle);
        planRequest.put("certificationDescription", certDescription);
        if (additionalInstructions != null && !additionalInstructions.isBlank()) {
            planRequest.put("additionalInstructions", additionalInstructions);
        }
        String planRequestJson = objectMapper.writeValueAsString(planRequest);

        log.info("Calling CurriculumPlanningAssistant for '{}'", certTitle);
        CurriculumPlanDTO plan = curriculumPlanningAssistant.planCurriculum(
                planRequestJson, truncate(documentContent, MAX_DOC_CHARS)
        );

        validatePlan(plan);
        return plan;
    }

    private void validatePlan(CurriculumPlanDTO plan) {
        if (plan.getMajorCategories() == null || plan.getMajorCategories().isEmpty()) {
            throw new InvalidAiResponseException("The AI returned an empty curriculum plan. Please try again.");
        }
        for (CurriculumMajorCategoryDTO major : plan.getMajorCategories()) {
            if (major.getTitle() == null || major.getTitle().isBlank()) {
                throw new InvalidAiResponseException("The AI returned a major category without a title.");
            }
            if (major.getMiddleCategories() == null || major.getMiddleCategories().isEmpty()) {
                throw new InvalidAiResponseException(
                        "The AI returned a major category without middle categories."
                );
            }
            for (CurriculumMiddleCategoryDTO middle : major.getMiddleCategories()) {
                if (middle.getTitle() == null || middle.getTitle().isBlank()) {
                    throw new InvalidAiResponseException("The AI returned a middle category without a title.");
                }
                if (middle.getLessons() == null || middle.getLessons().isEmpty()) {
                    throw new InvalidAiResponseException("The AI returned a middle category without lessons.");
                }
                for (CurriculumLessonDTO lesson : middle.getLessons()) {
                    if (lesson.getTitle() == null || lesson.getTitle().isBlank()) {
                        throw new InvalidAiResponseException("The AI returned a lesson without a title.");
                    }
                }
            }
        }
    }

    private String extractText(List<MultipartFile> files) throws IOException {
        StringBuilder rawText = new StringBuilder();
        for (MultipartFile file : files) {
            if (file != null && !file.isEmpty()) {
                log.info("Extracting text from '{}'", file.getOriginalFilename());
                rawText.append(documentIngestionService.extractDocumentText(file)).append("\n\n");
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
                    log.warn("Failed to ingest '{}' for RAG: {}", file.getOriginalFilename(), e.getMessage());
                }
            }
        }
    }






    private void generateLessonContents(Long certificationId, String additionalInstructions) {
        List<LessonCtx> lessons = self.loadLessonContexts(certificationId);
        log.info("Generating content for {} lessons of certification {}", lessons.size(), certificationId);

        for (int i = 0; i < lessons.size(); i++) {
            LessonCtx ctx = lessons.get(i);
            try {
                if (i > 0) {
                    Thread.sleep(7_000);
                }
                String content = generateLessonContent(ctx, additionalInstructions);
                self.saveLessonContent(ctx.lessonId(), content);
                lessonEmbeddingService.embedLessonContent(ctx.lessonId(), certificationId, ctx.lessonTitle(), content);
                log.info("[{}/{}] Saved lesson '{}' (id={})", i + 1, lessons.size(), ctx.lessonTitle(), ctx.lessonId());
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                log.warn("Lesson generation interrupted at lesson {}", ctx.lessonTitle());
                break;
            } catch (Exception e) {
                log.warn("Content generation failed for lesson '{}' id={}: {}",
                        ctx.lessonTitle(), ctx.lessonId(), e.getMessage());
            }
        }
    }

    private String generateLessonContent(LessonCtx ctx, String additionalInstructions) throws Exception {
        String queryText = String.join(" ", ctx.certTitle(), ctx.majorTitle(), ctx.midTitle(), ctx.lessonTitle());
        List<Content> contents = lessonContentRetriever.retrieve(Query.from(queryText));
        String referenceContext = contents.stream()
                .map(c -> c.textSegment().text())
                .collect(Collectors.joining("\n\n---\n\n"));

        if (referenceContext.isBlank()) {
            referenceContext = "No reference documents available. Generate based on your knowledge of the topic.";
        }

        Map<String, Object> req = new LinkedHashMap<>();
        req.put("lessonId", ctx.lessonId());
        req.put("lessonTitle", ctx.lessonTitle());
        req.put("middleCategoryTitle", ctx.midTitle());
        req.put("majorCategoryTitle", ctx.majorTitle());
        req.put("certificationTitle", ctx.certTitle());
        if (additionalInstructions != null && !additionalInstructions.isBlank()) {
            req.put("additionalInstructions", additionalInstructions);
        }
        String requestJson = objectMapper.writeValueAsString(req);

        for (int attempt = 1; attempt <= 2; attempt++) {
            lessonDraftCollector.clear();
            lessonGenerationAssistant.generateLessonDraft(requestJson, referenceContext);

            List<GeneratedLessonSectionDraftDto> sections = lessonDraftCollector.getSections();
            if (!sections.isEmpty()) {
                return objectMapper.writeValueAsString(toPersistedSections(sections));
            }
            log.warn("Attempt {}/2 for lesson '{}' produced no draft sections",
                    attempt, ctx.lessonTitle());
        }

        throw new InvalidAiResponseException(
                "Lesson draft generation produced no sections for lesson '" + ctx.lessonTitle() + "'");
    }

    // Draft tools already passed deterministic validation inside the tool
    // layer; persist them in the exact shape the lesson editor saves.
    // Authoring notes are draft-only and are intentionally dropped here.
    private List<Map<String, Object>> toPersistedSections(List<GeneratedLessonSectionDraftDto> sections) {
        List<Map<String, Object>> persisted = new ArrayList<>();
        for (GeneratedLessonSectionDraftDto section : sections) {
            List<Map<String, Object>> content = new ArrayList<>();
            for (GeneratedLessonToolDraftDto tool : section.content()) {
                Map<String, Object> toolMap = new LinkedHashMap<>();
                toolMap.put("id", tool.id().toString());
                toolMap.put("type", tool.type());
                toolMap.put("data", tool.data());
                content.add(toolMap);
            }
            Map<String, Object> sectionMap = new LinkedHashMap<>();
            sectionMap.put("id", section.id().toString());
            sectionMap.put("sectionName", section.sectionName());
            sectionMap.put("content", content);
            persisted.add(sectionMap);
        }
        return persisted;
    }

    private static String truncate(String text, int maxChars) {
        return text.length() <= maxChars ? text : text.substring(0, maxChars);
    }
}

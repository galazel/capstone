package com.capstone.rebyu.aigateway.client;

import com.capstone.rebyu.aigateway.dto.AnswerGradingRequestDto;
import com.capstone.rebyu.aigateway.dto.AnswerGradingResultDto;
import com.capstone.rebyu.aigateway.dto.ChatRequest;
import com.capstone.rebyu.aigateway.dto.ChatResponse;
import com.capstone.rebyu.aigateway.dto.LessonGenerationDraftResponseDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Typed, blocking client for the internal Python AI backend (FastAPI +
 * LangGraph). Java only triggers generation/grading/chat here and persists
 * whatever Python returns — no LLM calls happen in this codebase anymore.
 *
 * <p>Certification and question generation moved off this client entirely in
 * Phase 5/6 -- they're triggered by an async RabbitMQ message instead (see
 * CurriculumGenerationService/QuestionGenerationService). What remains here
 * is what's still genuinely synchronous: tutor chat, per-lesson draft
 * generation, answer grading, and study aids.
 */
@Slf4j
@Component
public class AiServiceClient {

    private final WebClient webClient;

    public AiServiceClient(WebClient aiWebClient) {
        this.webClient = aiWebClient;
    }

    public ChatResponse chat(ChatRequest request) {
        try {
            return webClient.post()
                    .uri("/tutor/chat")
                    .bodyValue(request)
                    .retrieve()
                    .bodyToMono(ChatResponse.class)
                    .block();
        } catch (Exception e) {
            throw new AiServiceException("Tutor chat request failed", e);
        }
    }

    public LessonGenerationDraftResponseDto generateLessonDraft(
            Long lessonId, List<MultipartFile> files, String additionalInstructions) {
        try {
            MultipartBodyBuilder parts = new MultipartBodyBuilder();
            parts.part("lessonId", lessonId);
            if (additionalInstructions != null) {
                parts.part("additionalInstructions", additionalInstructions);
            }
            attachFiles(parts, files);

            return webClient.post()
                    .uri("/lessons/generate")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(BodyInserters.fromMultipartData(parts.build()))
                    .retrieve()
                    .bodyToMono(LessonGenerationDraftResponseDto.class)
                    .block();
        } catch (Exception e) {
            throw new AiServiceException("Lesson draft generation request failed", e);
        }
    }

    public Optional<AnswerGradingResultDto> gradeAnswer(AnswerGradingRequestDto request) {
        try {
            AnswerGradingResultDto result = webClient.post()
                    .uri("/assessments/grade-answer")
                    .bodyValue(request)
                    .retrieve()
                    .bodyToMono(AnswerGradingResultDto.class)
                    .block();
            return Optional.ofNullable(result);
        } catch (Exception e) {
            log.warn("Answer grading request failed; leaving answer pending: {}", e.getMessage());
            return Optional.empty();
        }
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> generateStudyAid(String type, String lessonName, Long lessonId) {
        try {
            Map<String, Object> body = Map.of(
                    "type", type,
                    "lessonName", lessonName == null ? "" : lessonName,
                    "lessonId", lessonId
            );
            return webClient.post()
                    .uri("/study-aids/generate")
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
        } catch (Exception e) {
            throw new AiServiceException("Study aid generation request failed", e);
        }
    }

    private void attachFiles(MultipartBodyBuilder parts, List<MultipartFile> files) throws IOException {
        if (files == null) {
            return;
        }
        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) {
                continue;
            }
            parts.part("files", new ByteArrayResource(file.getBytes()) {
                        @Override
                        public String getFilename() {
                            return file.getOriginalFilename();
                        }
                    })
                    .contentType(MediaType.parseMediaType(
                            file.getContentType() != null ? file.getContentType() : "application/octet-stream"));
        }
    }
}

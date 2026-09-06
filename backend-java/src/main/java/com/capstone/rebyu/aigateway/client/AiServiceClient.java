package com.capstone.rebyu.aigateway.client;

import com.capstone.rebyu.aigateway.dto.AnswerGradingRequestDto;
import com.capstone.rebyu.aigateway.dto.AnswerGradingResultDto;
import com.capstone.rebyu.aigateway.dto.AppendConversationRequest;
import com.capstone.rebyu.aigateway.dto.ChatRequest;
import com.capstone.rebyu.aigateway.dto.ChatResponse;
import com.capstone.rebyu.aigateway.dto.ConversationResponseDto;
import com.capstone.rebyu.aigateway.dto.LessonGenerationDraftResponseDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

import java.io.IOException;
import java.util.List;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Duration;
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

    public AiServiceClient(@Qualifier("aiWebClient") WebClient aiWebClient) {
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

    public ConversationResponseDto getConversation(String sessionId) {
        try {
            return webClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/tutor/conversation")
                            .queryParam("sessionId", sessionId)
                            .build())
                    .retrieve()
                    .bodyToMono(ConversationResponseDto.class)
                    .block();
        } catch (Exception e) {
            throw new AiServiceException("Tutor conversation request failed", e);
        }
    }

    public ConversationResponseDto appendConversation(AppendConversationRequest request) {
        try {
            return webClient.post()
                    .uri("/tutor/conversation/messages")
                    .bodyValue(request)
                    .retrieve()
                    .bodyToMono(ConversationResponseDto.class)
                    .block();
        } catch (Exception e) {
            throw new AiServiceException("Recording the tutor conversation turn failed", e);
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

    /**
     * How long to wait for one answer to be marked.
     *
     * Generous on purpose. Submission now blocks on grading and the learner is
     * held on a loading screen while it runs, so the right trade here is to
     * wait rather than to give up: an answer that takes twelve seconds to mark
     * is a slow mark, while a timeout is a zero the learner did not earn.
     * Grading runs concurrently per question, so this is the cost of the
     * slowest single answer, not of the paper.
     */
    private static final Duration GRADING_TIMEOUT = Duration.ofSeconds(60);

    public Optional<AnswerGradingResultDto> gradeAnswer(AnswerGradingRequestDto request) {
        try {
            AnswerGradingResultDto result = webClient.post()
                    .uri("/assessments/grade-answer")
                    .bodyValue(request)
                    .retrieve()
                    .bodyToMono(AnswerGradingResultDto.class)
                    .block(GRADING_TIMEOUT);
            return Optional.ofNullable(result);
        } catch (WebClientResponseException e) {
            /* A 4xx is the service telling us the request itself is wrong --
               a missing route, a bad payload, a rejected key. Retrying cannot
               change any of those, and doing so cost three extra round trips
               and several seconds on every written answer. Raised so the
               caller stops immediately instead of trying again. */
            if (e.getStatusCode().is4xxClientError()) {
                log.error("Answer grading rejected with {} -- not retrying. "
                                + "Check that POST /assessments/grade-answer exists on the AI service.",
                        e.getStatusCode(), e);
                throw new AiServiceException(
                        "Answer grading endpoint returned " + e.getStatusCode(), e);
            }
            log.warn("Answer grading failed with {} -- retryable", e.getStatusCode(), e);
            return Optional.empty();
        } catch (Exception e) {
            /* Everything else -- timeouts, connection refusals, 5xx -- is worth
               another try. Logged with its type, not just its message:
               `getMessage()` alone is empty or useless for most WebClient
               failures, which is why a slow service and a dead one arrived here
               looking identical. */
            log.warn("Answer grading request failed [{}]: {}",
                    e.getClass().getSimpleName(), e.getMessage(), e);
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

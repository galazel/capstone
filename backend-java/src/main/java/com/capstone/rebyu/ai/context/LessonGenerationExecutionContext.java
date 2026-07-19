package com.capstone.rebyu.ai.context;

import com.capstone.rebyu.ai.dto.LessonToolEvidenceInputDto;
import com.capstone.rebyu.common.InvalidAiResponseException;
import org.springframework.context.annotation.Scope;
import org.springframework.context.annotation.ScopedProxyMode;
import org.springframework.stereotype.Component;
import org.springframework.web.context.WebApplicationContext;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
@Scope(value = WebApplicationContext.SCOPE_REQUEST, proxyMode = ScopedProxyMode.TARGET_CLASS)
public class LessonGenerationExecutionContext {

    public record SourceChunk(String id, String text, Set<String> imageKeys) {
        public SourceChunk(String id, String text) {
            this(id, text, Set.of());
        }
    }

    private final Map<String, SourceChunk> sourceChunks = new LinkedHashMap<>();

    public void initialize(List<SourceChunk> chunks) {
        sourceChunks.clear();
        if (chunks == null) {
            return;
        }
        for (SourceChunk chunk : chunks) {
            if (chunk == null || chunk.id() == null || chunk.id().isBlank()) {
                continue;
            }
            sourceChunks.put(chunk.id(), chunk);
        }
    }

    public List<SourceChunk> getSourceChunks() {
        return new ArrayList<>(sourceChunks.values());
    }

    public void validateEvidence(List<LessonToolEvidenceInputDto> evidence) {
        if (evidence == null || evidence.isEmpty()) {
            throw new InvalidAiResponseException("Grounded lesson content requires source evidence.");
        }

        for (LessonToolEvidenceInputDto item : evidence) {
            if (item == null || item.sourceChunkId() == null || item.sourceChunkId().isBlank()) {
                throw new InvalidAiResponseException("Every evidence item must include a sourceChunkId.");
            }
            if (!sourceChunks.containsKey(item.sourceChunkId())) {
                throw new InvalidAiResponseException(
                        "Unknown sourceChunkId '" + item.sourceChunkId() + "'."
                );
            }
        }
    }

    public String formatForPrompt() {
        if (sourceChunks.isEmpty()) {
            return "";
        }

        StringBuilder builder = new StringBuilder();
        for (SourceChunk chunk : sourceChunks.values()) {
            builder.append("[chunkId=").append(chunk.id()).append("]\n")
                    .append(chunk.text())
                    .append("\n\n---\n\n");
        }
        return builder.toString().trim();
    }

    public Set<String> chunkIds() {
        return Set.copyOf(sourceChunks.keySet());
    }

    public Set<String> allImageKeys() {
        Set<String> keys = new java.util.LinkedHashSet<>();
        for (SourceChunk chunk : sourceChunks.values()) {
            if (chunk.imageKeys() != null) {
                keys.addAll(chunk.imageKeys());
            }
        }
        return keys;
    }

    public void clear() {
        sourceChunks.clear();
    }
}

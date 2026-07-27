package com.capstone.rebyu.aigateway.dto;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import java.io.IOException;
import java.util.Locale;

public class GeneratedQuestionDifficultyDeserializer extends JsonDeserializer<GeneratedQuestionDifficulty> {
    @Override
    public GeneratedQuestionDifficulty deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
        String value = p.getValueAsString();
        if (value == null || value.isBlank()) {
            return null;
        }

        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "easy" -> GeneratedQuestionDifficulty.easy;
            case "average", "avg", "medium", "moderate" -> GeneratedQuestionDifficulty.average;
            case "hard", "difficult" -> GeneratedQuestionDifficulty.hard;
            default -> {
                ctxt.reportInputMismatch(GeneratedQuestionDifficulty.class, "Invalid difficulty: %s", value);
                yield null;
            }
        };
    }
}

package com.capstone.rebyu.aigateway.dto;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import java.io.IOException;
import java.util.Locale;

public class GeneratedQuestionTypeDeserializer extends JsonDeserializer<GeneratedQuestionType> {
    @Override
    public GeneratedQuestionType deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
        String value = p.getValueAsString();
        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return GeneratedQuestionType.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            ctxt.reportInputMismatch(GeneratedQuestionType.class, "Invalid question type: %s", value);
            return null;
        }
    }
}

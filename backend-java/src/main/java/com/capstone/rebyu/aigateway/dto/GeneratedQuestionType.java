package com.capstone.rebyu.aigateway.dto;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;

@JsonDeserialize(using = GeneratedQuestionTypeDeserializer.class)
public enum GeneratedQuestionType {
    MCQ,
    SHORT_ANSWER,
    DESCRIPTIVE,
    PROGRAMMING,
    DIAGRAM
}

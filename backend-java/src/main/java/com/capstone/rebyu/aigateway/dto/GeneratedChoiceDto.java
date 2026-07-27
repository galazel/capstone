package com.capstone.rebyu.aigateway.dto;

public record GeneratedChoiceDto(
        String choiceText,
        String explanation,
        Boolean isCorrect,
        String imageKey
) {
    public GeneratedChoiceDto(String choiceText, String explanation, Boolean isCorrect) {
        this(choiceText, explanation, isCorrect, null);
    }
}

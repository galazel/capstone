package com.capstone.rebyu.aigateway.dto;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;

@JsonDeserialize(using = GeneratedQuestionDifficultyDeserializer.class)
public enum GeneratedQuestionDifficulty {
    easy,
    average,
    hard
}

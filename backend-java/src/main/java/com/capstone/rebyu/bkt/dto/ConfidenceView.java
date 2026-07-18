package com.capstone.rebyu.bkt.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Certification confidence summary returned to the frontend. Mirrors the
 * FastAPI confidence response shape but is re-exposed through Spring Boot so
 * the browser never talks to FastAPI directly.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ConfidenceView(
        @JsonProperty("learner_id") Long learnerId,
        @JsonProperty("certification_id") Long certificationId,
        @JsonProperty("overall_confidence") Double overall_confidence,
        @JsonProperty("average_mastery") Double averageMastery,
        @JsonProperty("lessons_mastered") Integer lessons_mastered,
        @JsonProperty("good_count") Integer goodCount,
        @JsonProperty("lessons_developing") Integer lessons_developing,
        @JsonProperty("lessons_weak") Integer lessons_weak,
        @JsonProperty("total_lessons") Integer total_lessons,
        @JsonProperty("ready_for_certification") Boolean ready_for_certification,
        @JsonProperty("coverage_percentage") Double coveragePercentage
) {
}

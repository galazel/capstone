package com.capstone.rebyu.bkt.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Certification confidence summary returned to the frontend. Mirrors FastAPI's
 * {@code ConfidenceResponse} (app/schemas/priority.py) field-for-field; it is
 * re-exposed through Spring Boot so the browser never talks to FastAPI
 * directly. @JsonProperty fixes the wire format (snake_case, matching FastAPI)
 * independently of these Java member names, so callers get normal camelCase
 * accessors on both the deserialize and serialize side.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ConfidenceView(
        @JsonProperty("learner_id") Long learnerId,
        @JsonProperty("certification_id") Long certificationId,
        // 0-100; FastAPI already scales this, do not multiply again.
        @JsonProperty("confidence_score") Double confidenceScore,
        // 0-1 evidence-weighted mean mastery.
        @JsonProperty("average_mastery") Double averageMastery,
        @JsonProperty("mastered_count") Integer masteredCount,
        @JsonProperty("good_count") Integer goodCount,
        @JsonProperty("developing_count") Integer developingCount,
        @JsonProperty("weak_count") Integer weakCount,
        @JsonProperty("total_lessons") Integer totalLessons,
        @JsonProperty("coverage_percentage") Double coveragePercentage
) {
}

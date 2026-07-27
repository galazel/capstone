package com.capstone.rebyu.assessment.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "rebyu.assessment.retake")
public class RetakeProperties {

    private boolean enabled = true;
    private int minEvidencePerCell = 1;
    private double weakAccuracyThreshold = 0.40;
    private double weakBoostFactor = 1.50;
    private double strongAccuracyThreshold = 0.85;
    private double strongReductionFactor = 0.50;
}

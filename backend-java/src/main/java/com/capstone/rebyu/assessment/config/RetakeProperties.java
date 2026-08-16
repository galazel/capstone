package com.capstone.rebyu.assessment.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration for adaptive assessment retake question selection. Tuning
 * these does not require touching the selection logic itself.
 */
@Component
@ConfigurationProperties(prefix = "retake")
public class RetakeProperties {

    /** Master switch. When false, retakes always replay the exam's fixed question list. */
    private boolean enabled = true;

    /** A lesson/difficulty cell's accuracy below this is "weak" -- gets a boosted share. */
    private double weakAccuracyThreshold = 0.70;

    /** A lesson/difficulty cell's accuracy above this is "strong" -- gets a reduced share. */
    private double strongAccuracyThreshold = 0.85;

    /** Multiplier applied to a weak cell's baseline share of the new question set. */
    private double weakBoostFactor = 1.5;

    /** Multiplier applied to a strong cell's baseline share of the new question set. */
    private double strongReductionFactor = 0.5;

    /** Minimum graded answers in a cell before its accuracy is trusted enough to adjust it. */
    private int minEvidencePerCell = 2;

    /**
     * How much of a difficulty tier's share moves to an adjacent tier when the
     * learner's performance in that lesson calls for it.
     *
     * Half by default: enough to visibly change the mix of a retake, not so
     * much that one bad run at Hard erases Hard from the lesson entirely. The
     * migration is per lesson, so being weak at Hard in one lesson never makes
     * another lesson easier.
     */
    private double difficultyMigrationFactor = 0.5;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public double getWeakAccuracyThreshold() {
        return weakAccuracyThreshold;
    }

    public void setWeakAccuracyThreshold(double weakAccuracyThreshold) {
        this.weakAccuracyThreshold = weakAccuracyThreshold;
    }

    public double getStrongAccuracyThreshold() {
        return strongAccuracyThreshold;
    }

    public void setStrongAccuracyThreshold(double strongAccuracyThreshold) {
        this.strongAccuracyThreshold = strongAccuracyThreshold;
    }

    public double getWeakBoostFactor() {
        return weakBoostFactor;
    }

    public void setWeakBoostFactor(double weakBoostFactor) {
        this.weakBoostFactor = weakBoostFactor;
    }

    public double getStrongReductionFactor() {
        return strongReductionFactor;
    }

    public void setStrongReductionFactor(double strongReductionFactor) {
        this.strongReductionFactor = strongReductionFactor;
    }

    public int getMinEvidencePerCell() {
        return minEvidencePerCell;
    }

    public double getDifficultyMigrationFactor() {
        return difficultyMigrationFactor;
    }

    public void setDifficultyMigrationFactor(double difficultyMigrationFactor) {
        this.difficultyMigrationFactor = difficultyMigrationFactor;
    }

    public void setMinEvidencePerCell(int minEvidencePerCell) {
        this.minEvidencePerCell = minEvidencePerCell;
    }
}

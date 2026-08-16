package com.capstone.rebyu.progress.service;

import java.util.Arrays;
import java.util.Optional;

/**
 * The achievements REBYU can award, and the copy that goes with each one.
 *
 * <p>The enum -- not the database id -- is the identity an award is written
 * against. `achievements.achievement_id` is generated per environment (the ids
 * differ between a developer database and production), so anything that keys
 * off the id, including a frontend that posts "achievement 32", awards the
 * wrong badge the moment it runs somewhere else. {@code title} is unique on the
 * table, so it is the natural key both the seeder and the award service match
 * on.
 *
 * <p>The badge artwork lives in the frontend (`src/assets/<slug>.png`), keyed by
 * {@link #slug()}. That is why the entity carries no `image_key`: shipping the
 * image with the client means no S3 round-trip and no broken badge when a key
 * goes stale.
 */
public enum AchievementCatalog {

    FIRST_STEP("First Step",
            "Complete your first learning activity and take the first step toward your goal."),
    FIRST_QUIZ("First Quiz",
            "Complete your very first quiz and begin your learning journey."),
    FIRST_PERFECT_SCORE("First Perfect Score",
            "Achieve your first perfect score on a quiz or assessment."),
    EXAM_READY("Exam Ready",
            "Complete your preparation and prove you're ready to take the exam."),
    KNOWLEDGE_SEEKER("Knowledge Seeker",
            "Enroll in multiple certifications and expand your knowledge across different fields."),
    FINISHER("Finisher",
            "Complete an entire certification review from start to finish."),
    TOP_ACHIEVER("Top Achiever",
            "Demonstrate outstanding performance and rank among the top learners."),
    /** Awarded off the other seven, so it is always evaluated last. */
    REBYU_LEGEND("Rebyu Legend",
            "Unlock every achievement and become a true Rebyu Legend.");

    private final String title;
    private final String description;

    AchievementCatalog(String title, String description) {
        this.title = title;
        this.description = description;
    }

    public String title() {
        return title;
    }

    public String description() {
        return description;
    }

    /** `FIRST_PERFECT_SCORE` -> `first-perfect-score`, matching the asset filenames. */
    public String slug() {
        return name().toLowerCase().replace('_', '-');
    }

    public static Optional<AchievementCatalog> byTitle(String title) {
        return Arrays.stream(values())
                .filter(entry -> entry.title.equalsIgnoreCase(title))
                .findFirst();
    }
}

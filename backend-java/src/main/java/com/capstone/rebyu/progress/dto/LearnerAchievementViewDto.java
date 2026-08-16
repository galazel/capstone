package com.capstone.rebyu.progress.dto;

import java.time.LocalDateTime;

/**
 * One achievement as the learner sees it -- the whole catalog is returned, with
 * the locked ones carrying {@code earned = false}. A list of only the earned
 * ones cannot render the "3 of 8" panel the portal shows, and the locked rows
 * are what tell the learner what there is left to chase.
 *
 * @param code the {@code AchievementCatalog} constant, which is what the
 *             frontend keys its badge artwork off (never the database id --
 *             that differs per environment)
 */
public record LearnerAchievementViewDto(
        Long achievementId,
        String code,
        String slug,
        String title,
        String description,
        boolean earned,
        LocalDateTime earnedAt) {
}

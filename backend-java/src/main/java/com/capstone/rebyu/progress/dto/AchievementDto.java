package com.capstone.rebyu.progress.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AchievementDto {
    private Long achievementId;

    @NotBlank
    @Size(max = 100)
    private String title;

    @NotBlank
    private String description;

    // No imageKey: badge artwork ships with the frontend, keyed by the
    // AchievementCatalog slug, so there is no storage key to carry here.
}

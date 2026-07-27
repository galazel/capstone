package com.capstone.rebyu.aigateway.dto;

import java.util.List;
import java.util.UUID;

public record GeneratedLessonSectionDraftDto(
        UUID id,
        String sectionName,
        List<GeneratedLessonToolDraftDto> content
) {
}

package com.capstone.rebyu.aigateway.dto;

import java.util.UUID;

public record GeneratedLessonToolDraftDto(
        UUID id,
        String type,
        Object data,
        String authoringNotes
) {
}

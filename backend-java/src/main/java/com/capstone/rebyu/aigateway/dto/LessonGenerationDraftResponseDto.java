package com.capstone.rebyu.aigateway.dto;

import java.util.List;

public record LessonGenerationDraftResponseDto(
        List<GeneratedLessonSectionDraftDto> sections,
        LessonGenerationAnalysisDto analysis,
        List<String> warnings
) {

    public record LessonGenerationAnalysisDto(
            Long lessonId,
            String lessonTitle,
            Integer sectionCount,
            Integer toolCount,
            Integer sourceChunksUsed,
            Integer uploadedFilesUsed
    ) {
    }
}

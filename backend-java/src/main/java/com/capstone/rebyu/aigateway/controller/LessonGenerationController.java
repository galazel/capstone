package com.capstone.rebyu.aigateway.controller;

import com.capstone.rebyu.aigateway.dto.LessonGenerationDraftResponseDto;
import com.capstone.rebyu.aigateway.service.LessonGenerationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/ai/lessons")
@RequiredArgsConstructor
public class LessonGenerationController {

    private final LessonGenerationService lessonGenerationService;

    @PostMapping(value = "/generate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public LessonGenerationDraftResponseDto generate(
            @RequestParam("lessonId") Long lessonId,
            @RequestParam(value = "files", required = false) List<MultipartFile> files,
            @RequestParam(value = "additionalInstructions", required = false) String additionalInstructions
    ) throws IOException {
        return lessonGenerationService.generateDrafts(lessonId, files, additionalInstructions);
    }
}

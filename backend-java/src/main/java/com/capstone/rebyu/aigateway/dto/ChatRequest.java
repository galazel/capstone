package com.capstone.rebyu.aigateway.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatRequest {

    @NotBlank
    private String message;

    @NotBlank
    private String sessionId;

    // Boxed so @NotNull applies correctly; @NotBlank is invalid on numeric types.
    @NotNull
    private String lessonName;

    // Nullable: older callers (or a tutor opened outside a lesson) still work,
    // just without the AI grounding its answer in the lesson's content.
    private Long lessonId;
}

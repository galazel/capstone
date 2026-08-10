package com.capstone.rebyu.aigateway.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Records turns the model never produced -- currently the AI tutor's
 * "generate a quiz/flashcards" exchange, which is a real part of the
 * conversation but bypasses the chat graph entirely.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AppendConversationRequest {

    @NotBlank
    private String sessionId;

    private List<ConversationMessageDto> messages;
}

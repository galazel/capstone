package com.capstone.rebyu.aigateway.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConversationMessageDto {
    private String role;
    private String content;

    /**
     * Only present on a generated quiz/flashcard turn -- the payload the
     * tutor UI rebuilds its "Take the quiz" card from. Opaque here: this
     * gateway just carries it between the browser and the Python service.
     */
    private Map<String, Object> action;
}

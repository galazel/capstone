package com.capstone.rebyu.aigateway.controller;

import com.capstone.rebyu.aigateway.dto.AppendConversationRequest;
import com.capstone.rebyu.aigateway.dto.ChatRequest;
import com.capstone.rebyu.aigateway.dto.ChatResponse;
import com.capstone.rebyu.aigateway.dto.ConversationResponseDto;
import com.capstone.rebyu.aigateway.service.AiChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiChatController {

    private final AiChatService aiChatService;

    @PostMapping("/tutor")
    public ChatResponse chat(@Valid @RequestBody ChatRequest request) {
        return aiChatService.chat(request);
    }

    @GetMapping("/tutor/conversation")
    public ConversationResponseDto getConversation(@RequestParam String sessionId) {
        return aiChatService.getConversation(sessionId);
    }

    /** Records a turn the model didn't produce (a generated quiz/flashcard set). */
    @PostMapping("/tutor/conversation/messages")
    public ConversationResponseDto appendConversation(
            @Valid @RequestBody AppendConversationRequest request) {
        return aiChatService.appendConversation(request);
    }
}

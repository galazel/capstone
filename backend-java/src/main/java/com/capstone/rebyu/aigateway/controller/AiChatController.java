package com.capstone.rebyu.aigateway.controller;

import com.capstone.rebyu.aigateway.dto.ChatRequest;
import com.capstone.rebyu.aigateway.dto.ChatResponse;
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
}

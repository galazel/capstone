package com.capstone.rebyu.aigateway.service;

import com.capstone.rebyu.aigateway.client.AiServiceClient;
import com.capstone.rebyu.aigateway.dto.ChatRequest;
import com.capstone.rebyu.aigateway.dto.ChatResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** Thin trigger: tutor chat is generated entirely by the Python AI backend. */
@Service
@RequiredArgsConstructor
public class AiChatService {

    private final AiServiceClient aiServiceClient;

    public ChatResponse chat(ChatRequest request) {
        return aiServiceClient.chat(request);
    }
}

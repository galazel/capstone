package com.capstone.rebyu.ai.assistant;

import com.capstone.rebyu.ai.tools.LessonComponentDraftTools;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import dev.langchain4j.service.AiServices;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Guards the tool-calling wiring: builds the LessonGenerationAssistant AiService with
 * the real LessonComponentDraftTools attached. Building an AiService makes LangChain4j
 * generate a JSON schema for every @Tool method's parameters — the exact step that
 * failed historically for these complex nested DTOs. This runs with no network/DB
 * (build() never calls the model and never invokes the tools), so it catches a
 * schema-generation regression that would otherwise only surface at app startup.
 */
class LessonAssistantToolWiringTest {

    @Test
    void aiServiceBuildsWithLessonTools() {
        ChatModel dummy = OpenAiChatModel.builder()
                .apiKey("test-key")
                .baseUrl("http://localhost:8080")
                .modelName("gpt-4.1-mini")
                .build();

        // Null collaborators are fine here: building the AiService only reflects over
        // the @Tool parameter schemas; it never invokes the tool methods.
        LessonComponentDraftTools tools = new LessonComponentDraftTools(null, null, null, null);

        LessonGenerationAssistant assistant = AiServices.builder(LessonGenerationAssistant.class)
                .chatModel(dummy)
                .tools(tools)
                .build();

        assertNotNull(assistant);
    }
}

package com.capstone.rebyu.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.capstone.rebyu.ai.assistant.AnswerGradingAssistant;
import com.capstone.rebyu.ai.assistant.CurriculumPlanningAssistant;
import com.capstone.rebyu.ai.assistant.LessonGenerationAssistant;
import com.capstone.rebyu.ai.assistant.QuestionGenerationAssistant;
import com.capstone.rebyu.ai.assistant.ReviewAssistant;
import com.capstone.rebyu.ai.tools.LessonComponentDraftTools;
import com.capstone.rebyu.ai.tools.QuestionTool;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.memory.chat.ChatMemoryProvider;
import dev.langchain4j.memory.chat.MessageWindowChatMemory;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.embedding.onnx.bgesmallenv15q.BgeSmallEnV15QuantizedEmbeddingModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import dev.langchain4j.rag.content.retriever.ContentRetriever;
import dev.langchain4j.rag.content.retriever.EmbeddingStoreContentRetriever;
import dev.langchain4j.service.AiServices;
import dev.langchain4j.store.embedding.EmbeddingStore;
import dev.langchain4j.store.embedding.pgvector.PgVectorEmbeddingStore;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AiConfig {

    @Value("${langchain4j.open-ai.chat-model.api-key}")
    private String apiKey;

    @Value("${langchain4j.open-ai.chat-model.base-url}")
    private String baseUrl;

    @Value("${langchain4j.open-ai.chat-model.model-name}")
    private String chatModelName;

    @Value("${langchain4j.open-ai.chat-model.temperature}")
    private double temperature;

    @Value("${langchain4j.open-ai.chat-model.max-tokens:8192}")
    private int maxTokens;

    @Value("${spring.datasource.url}")
    private String jdbcUrl;

    @Value("${spring.datasource.username}")
    private String dbUsername;

    @Value("${spring.datasource.password}")
    private String dbPassword;

    @Value("${db.host}")
    private String host;

    @Value("${db.port}")
    private int port;

    @Value("${db.database}")
    private String database;



    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.findAndRegisterModules();
        return mapper;
    }

    @Bean
    public ChatModel chatModel() {
        return OpenAiChatModel.builder()
                .apiKey(apiKey)
                .baseUrl(baseUrl)
                .modelName(chatModelName)
                .temperature(temperature)
                .maxTokens(maxTokens)
                .timeout(java.time.Duration.ofSeconds(180))
                .logRequests(false)
                .logResponses(false)
                .build();
    }

    @Bean
    public EmbeddingModel embeddingModel() {

        return new BgeSmallEnV15QuantizedEmbeddingModel();
    }

    @Bean("lessonEmbeddingStore")
    public EmbeddingStore<TextSegment> lessonEmbeddingStore() {
        return PgVectorEmbeddingStore.builder()
                .host(host)
                .port(port)
                .database(database)
                .user(dbUsername)
                .password(dbPassword)
                .table("lesson_embeddings")
                .dimension(384)
                .createTable(true)
                .build();
    }

    @Bean("questionEmbeddingStore")
    public EmbeddingStore<TextSegment> questionEmbeddingStore() {
        return PgVectorEmbeddingStore.builder()
                .host(host)
                .port(port)
                .database(database)
                .user(dbUsername)
                .password(dbPassword)
                .table("question_embeddings")
                .dimension(384)
                .createTable(true)
                .build();
    }

    @Bean("lessonContentRetriever")
    public ContentRetriever lessonContentRetriever(
            @Qualifier("lessonEmbeddingStore") EmbeddingStore<TextSegment> lessonEmbeddingStore,
            EmbeddingModel embeddingModel
    ) {
        return EmbeddingStoreContentRetriever.builder()
                .embeddingStore(lessonEmbeddingStore)
                .embeddingModel(embeddingModel)
                .maxResults(8)
                .minScore(0.25)
                .build();
    }

    @Bean("questionContentRetriever")
    public ContentRetriever questionContentRetriever(
            @Qualifier("questionEmbeddingStore") EmbeddingStore<TextSegment> questionEmbeddingStore,
            EmbeddingModel embeddingModel
    ) {
        return EmbeddingStoreContentRetriever.builder()
                .embeddingStore(questionEmbeddingStore)
                .embeddingModel(embeddingModel)
                .maxResults(5)
                .minScore(0.25)
                .build();
    }

    @Bean
    public ChatMemoryProvider chatMemoryProvider() {
        return memoryId -> MessageWindowChatMemory.builder()
                .id(memoryId)
                .maxMessages(20)
                .build();
    }

    @Bean
    public ReviewAssistant reviewAssistant(
            ChatModel chatModel,
            ChatMemoryProvider chatMemoryProvider,
            @Qualifier("lessonContentRetriever") ContentRetriever lessonContentRetriever
    ) {
        return AiServices.builder(ReviewAssistant.class)
                .chatModel(chatModel)
                .chatMemoryProvider(chatMemoryProvider)
                .contentRetriever(lessonContentRetriever)
                .build();
    }

    @Bean
    public LessonGenerationAssistant lessonGenerationAssistant(
            ChatModel chatModel,
            LessonComponentDraftTools lessonComponentDraftTools,
            @Qualifier("lessonContentRetriever")
            ContentRetriever lessonContentRetriever
    ) {
        return AiServices.builder(LessonGenerationAssistant.class)
                .chatModel(chatModel)
                .contentRetriever(lessonContentRetriever)
                .tools(lessonComponentDraftTools)
                .build();
    }

    @Bean
    public QuestionGenerationAssistant questionGenerationAssistant(
            ChatModel chatModel,
            QuestionTool questionTool,
            @Qualifier("questionContentRetriever")
            ContentRetriever questionContentRetriever
    ) {
        return AiServices.builder(QuestionGenerationAssistant.class)
                .chatModel(chatModel)
                .contentRetriever(questionContentRetriever)
                .tools(questionTool)
                .build();
    }

    @Bean
    public CurriculumPlanningAssistant curriculumPlanningAssistant(
            ChatModel chatModel,
            @Qualifier("lessonContentRetriever") ContentRetriever lessonContentRetriever
    ) {
        return AiServices.builder(CurriculumPlanningAssistant.class)
                .chatModel(chatModel)
                .contentRetriever(lessonContentRetriever)
                .build();
    }

    @Bean
    public AnswerGradingAssistant answerGradingAssistant(ChatModel chatModel) {
        return AiServices.builder(AnswerGradingAssistant.class)
                .chatModel(chatModel)
                .build();
    }
}

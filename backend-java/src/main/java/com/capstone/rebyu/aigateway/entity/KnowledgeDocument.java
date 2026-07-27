package com.capstone.rebyu.aigateway.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "knowledge_documents")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KnowledgeDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long knowledgeDocumentId;

    @Column(name = "filename", nullable = false)
    private String filename;

    @Column(name = "original_filename", nullable = false)
    private String originalFilename;

    @Column(name = "content_type", nullable = false)
    private String contentType;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "s3_key")
    private String s3Key;

    @Column(name = "chunk_count")
    private Integer chunkCount;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private DocumentStatus status = DocumentStatus.PROCESSING;

    @Column(name = "uploaded_at", nullable = false)
    private LocalDateTime uploadedAt;

    @Column(name = "processed_at")
    private LocalDateTime processedAt;

    @Column(name = "certification_id")
    private Long certificationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "use_case", nullable = false)
    @Builder.Default
    private UseCase useCase = UseCase.LESSON;

    public enum DocumentStatus {
        PROCESSING, READY, FAILED
    }

    public enum UseCase {
        LESSON, QUESTION
    }
}

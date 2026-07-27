package com.capstone.rebyu.aigateway.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * One image extracted from an ingested {@link KnowledgeDocument} (PDF/DOCX)
 * during ingestion, stored separately from the text embeddings. The owning
 * text chunk(s) reference this image's {@code imageKey} via a
 * {@code imageKeys} entry in that chunk's pgvector metadata — the image
 * itself is never embedded, only linked.
 */
@Entity
@Table(name = "knowledge_document_images")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KnowledgeDocumentImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long knowledgeDocumentImageId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "knowledge_document_id", nullable = false)
    private KnowledgeDocument knowledgeDocument;

    /** S3 key — the same trusted identifier saved as Question.imageKey/Choice.imageKey. */
    @Column(name = "image_key", nullable = false, unique = true, length = 255)
    private String imageKey;

    @Column(name = "content_type", length = 100)
    private String contentType;

    @Column(name = "page_number")
    private Integer pageNumber;

    @Column(name = "order_in_page")
    private Integer orderInPage;

    /** Short text captured near the image at extraction time (caption/context for the AI prompt). */
    @Column(name = "nearby_text", columnDefinition = "TEXT")
    private String nearbyText;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}

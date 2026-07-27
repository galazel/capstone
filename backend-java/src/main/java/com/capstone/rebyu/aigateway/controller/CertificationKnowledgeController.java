package com.capstone.rebyu.aigateway.controller;

import com.capstone.rebyu.aigateway.entity.KnowledgeDocument;
import com.capstone.rebyu.aigateway.repository.KnowledgeDocumentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Learner/admin-safe knowledge base status. Exposes only counts — never
 * vectors, chunk contents, prompts, or private file content.
 */
@RestController
@RequestMapping("/api/certifications")
@RequiredArgsConstructor
public class CertificationKnowledgeController {

    private final KnowledgeDocumentRepository knowledgeDocumentRepository;

    public record CertificationKnowledgeStatusDto(
            Long certificationId,
            boolean hasIndexedKnowledge,
            Integer indexedDocumentCount,
            Integer indexedChunkCount
    ) {
    }

    @GetMapping("/{certificationId}/knowledge-status")
    public CertificationKnowledgeStatusDto getKnowledgeStatus(
            @PathVariable Long certificationId) {
        List<KnowledgeDocument> documents = knowledgeDocumentRepository
                .findByCertificationIdAndStatus(
                        certificationId, KnowledgeDocument.DocumentStatus.READY);
        int chunkCount = documents.stream()
                .mapToInt(doc -> doc.getChunkCount() == null ? 0 : doc.getChunkCount())
                .sum();
        return new CertificationKnowledgeStatusDto(
                certificationId,
                !documents.isEmpty(),
                documents.size(),
                chunkCount
        );
    }
}

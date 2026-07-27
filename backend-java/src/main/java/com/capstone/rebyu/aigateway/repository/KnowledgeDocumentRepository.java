package com.capstone.rebyu.aigateway.repository;

import com.capstone.rebyu.aigateway.entity.KnowledgeDocument;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface KnowledgeDocumentRepository extends JpaRepository<KnowledgeDocument, Long> {
    List<KnowledgeDocument> findByStatus(KnowledgeDocument.DocumentStatus status);

    List<KnowledgeDocument> findByCertificationIdAndStatus(
            Long certificationId, KnowledgeDocument.DocumentStatus status);

    long countByCertificationIdAndStatus(
            Long certificationId, KnowledgeDocument.DocumentStatus status);
}

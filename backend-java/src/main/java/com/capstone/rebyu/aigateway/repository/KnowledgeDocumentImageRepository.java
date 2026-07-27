package com.capstone.rebyu.aigateway.repository;

import com.capstone.rebyu.aigateway.entity.KnowledgeDocumentImage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface KnowledgeDocumentImageRepository extends JpaRepository<KnowledgeDocumentImage, Long> {

    List<KnowledgeDocumentImage> findByKnowledgeDocument_KnowledgeDocumentId(Long knowledgeDocumentId);

    List<KnowledgeDocumentImage> findByImageKeyIn(Collection<String> imageKeys);
}

package com.capstone.rebyu.aigateway.service;

import com.capstone.rebyu.aigateway.dto.KnowledgeDocumentDto;
import com.capstone.rebyu.aigateway.entity.KnowledgeDocument;
import com.capstone.rebyu.aigateway.entity.KnowledgeDocumentImage;
import com.capstone.rebyu.aigateway.mapper.KnowledgeDocumentMapper;
import com.capstone.rebyu.aigateway.repository.KnowledgeDocumentImageRepository;
import com.capstone.rebyu.aigateway.repository.KnowledgeDocumentRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Stores uploaded knowledge documents in S3 and records them in the DB.
 * Text extraction, chunking, and embedding are handled by the Python AI
 * backend, not here — this service only owns document storage plus the
 * embedded-image extraction used to link images back to a document.
 */
@Slf4j
@Service
@Transactional
public class DocumentIngestionService {

    private final KnowledgeDocumentRepository knowledgeDocumentRepository;
    private final KnowledgeDocumentImageRepository knowledgeDocumentImageRepository;
    private final KnowledgeDocumentMapper knowledgeDocumentMapper;
    private final QuestionSourceImageService questionSourceImageService;
    private final S3Client s3Client;
    private final String bucketName;

    public DocumentIngestionService(
            KnowledgeDocumentRepository knowledgeDocumentRepository,
            KnowledgeDocumentImageRepository knowledgeDocumentImageRepository,
            KnowledgeDocumentMapper knowledgeDocumentMapper,
            QuestionSourceImageService questionSourceImageService,
            S3Client s3Client,
            @Value("${aws.s3.bucket-name}") String bucketName
    ) {
        this.knowledgeDocumentRepository = knowledgeDocumentRepository;
        this.knowledgeDocumentImageRepository = knowledgeDocumentImageRepository;
        this.knowledgeDocumentMapper = knowledgeDocumentMapper;
        this.questionSourceImageService = questionSourceImageService;
        this.s3Client = s3Client;
        this.bucketName = bucketName;
    }

    public KnowledgeDocumentDto ingest(MultipartFile file, Long certificationId, KnowledgeDocument.UseCase useCase) throws java.io.IOException {
        KnowledgeDocument doc = KnowledgeDocument.builder()
                .filename(UUID.randomUUID() + "_" + file.getOriginalFilename())
                .originalFilename(file.getOriginalFilename())
                .contentType(file.getContentType())
                .fileSize(file.getSize())
                .certificationId(certificationId)
                .useCase(useCase)
                .status(KnowledgeDocument.DocumentStatus.PROCESSING)
                .uploadedAt(LocalDateTime.now())
                .build();
        doc = knowledgeDocumentRepository.save(doc);

        try {
            String s3Key = "ai-documents/" + doc.getFilename();

            byte[] bytes = file.getBytes();

            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket(bucketName)
                            .key(s3Key)
                            .contentType(file.getContentType())
                            .build(),
                    RequestBody.fromBytes(bytes)
            );

            // Best-effort embedded-image extraction so images can later be
            // linked back to this document; falls back to plain-text decode
            // for non-PDF/DOCX types (unused for anything but image linking —
            // Python re-parses and chunks the document itself).
            String fallbackText = new String(bytes, StandardCharsets.UTF_8);
            QuestionSourceImageService.ExtractedSource extracted =
                    questionSourceImageService.extract(file, fallbackText);
            persistExtractedImages(doc, extracted.images());

            doc.setS3Key(s3Key);
            doc.setStatus(KnowledgeDocument.DocumentStatus.READY);
            doc.setProcessedAt(LocalDateTime.now());
            doc = knowledgeDocumentRepository.save(doc);

            log.info("Stored document '{}' (id={})", doc.getOriginalFilename(), doc.getKnowledgeDocumentId());
        } catch (Exception e) {
            log.error("Failed to ingest document '{}'", doc.getOriginalFilename(), e);
            doc.setStatus(KnowledgeDocument.DocumentStatus.FAILED);
            knowledgeDocumentRepository.save(doc);
            throw e;
        }

        return knowledgeDocumentMapper.toDto(doc);
    }

    public List<KnowledgeDocumentDto> ingestAll(List<MultipartFile> files, Long certificationId, KnowledgeDocument.UseCase useCase) throws java.io.IOException {
        List<KnowledgeDocumentDto> results = new ArrayList<>();
        for (MultipartFile file : files) {
            results.add(ingest(file, certificationId, useCase));
        }
        return results;
    }

    @Transactional(readOnly = true)
    public List<KnowledgeDocumentDto> getAll() {
        return knowledgeDocumentRepository.findAll().stream()
                .map(knowledgeDocumentMapper::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public KnowledgeDocumentDto getById(Long id) {
        return knowledgeDocumentMapper.toDto(findEntity(id));
    }

    public void delete(Long id) {
        KnowledgeDocument doc = findEntity(id);

        if (doc.getS3Key() != null) {
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(doc.getS3Key())
                    .build());
        }

        // Extracted images are stored separately from the document's own S3
        // object; the DB rows cascade with the document via the FK.
        for (KnowledgeDocumentImage image :
                knowledgeDocumentImageRepository.findByKnowledgeDocument_KnowledgeDocumentId(id)) {
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(image.getImageKey())
                    .build());
        }

        knowledgeDocumentRepository.delete(doc);
        log.info("Deleted document id={}", id);
    }

    private void persistExtractedImages(
            KnowledgeDocument doc, List<QuestionSourceImageService.ExtractedImage> images) {
        LocalDateTime now = LocalDateTime.now();
        for (QuestionSourceImageService.ExtractedImage image : images) {
            knowledgeDocumentImageRepository.save(KnowledgeDocumentImage.builder()
                    .knowledgeDocument(doc)
                    .imageKey(image.key())
                    .contentType(image.contentType())
                    .pageNumber(image.page())
                    .orderInPage(image.order())
                    .nearbyText(image.nearbyText())
                    .createdAt(now)
                    .build());
        }
        if (!images.isEmpty()) {
            log.info("Linked {} image(s) to document '{}'", images.size(), doc.getOriginalFilename());
        }
    }

    private KnowledgeDocument findEntity(Long id) {
        return knowledgeDocumentRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("KnowledgeDocument not found: " + id));
    }
}

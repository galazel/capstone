package com.capstone.rebyu.aigateway.controller;

import com.capstone.rebyu.aigateway.dto.KnowledgeDocumentDto;
import com.capstone.rebyu.aigateway.entity.KnowledgeDocument;
import com.capstone.rebyu.aigateway.service.DocumentIngestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/ai/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentIngestionService documentIngestionService;

    @GetMapping
    public List<KnowledgeDocumentDto> getAll() {
        return documentIngestionService.getAll();
    }

    @GetMapping("/{id}")
    public KnowledgeDocumentDto getById(@PathVariable Long id) {
        return documentIngestionService.getById(id);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public List<KnowledgeDocumentDto> upload(
            @RequestParam("files") List<MultipartFile> files,
            @RequestParam("certificationId") Long certificationId,
            @RequestParam("useCase") KnowledgeDocument.UseCase useCase
    ) throws IOException {
        return documentIngestionService.ingestAll(files, certificationId, useCase);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        documentIngestionService.delete(id);
    }
}

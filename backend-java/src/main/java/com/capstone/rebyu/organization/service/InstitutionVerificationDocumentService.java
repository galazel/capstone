package com.capstone.rebyu.organization.service;

import com.capstone.rebyu.organization.dto.InstitutionVerificationDocumentDto;
import com.capstone.rebyu.organization.entity.InstitutionVerificationDocument;
import com.capstone.rebyu.organization.mapper.InstitutionVerificationDocumentMapper;
import com.capstone.rebyu.organization.repository.InstitutionVerificationDocumentRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class InstitutionVerificationDocumentService {
    private final InstitutionVerificationDocumentRepository repository;
    private final InstitutionVerificationDocumentMapper mapper;

    public List<InstitutionVerificationDocumentDto> getAll() {
        return repository.findAll().stream().map(mapper::toDto).toList();
    }

    public InstitutionVerificationDocumentDto getById(Long id) {
        return mapper.toDto(findEntity(id));
    }

    public InstitutionVerificationDocumentDto create(InstitutionVerificationDocumentDto dto) {
        InstitutionVerificationDocument entity = mapper.toEntity(dto);
        entity.setInstitutionDocumentId(null);
        InstitutionVerificationDocumentDto result = mapper.toDto(repository.save(entity));
        log.info("InstitutionVerificationDocument created with id: {}", result.getInstitutionDocumentId());
        return result;
    }

    public InstitutionVerificationDocumentDto update(Long id, InstitutionVerificationDocumentDto dto) {
        findEntity(id);
        InstitutionVerificationDocument entity = mapper.toEntity(dto);
        entity.setInstitutionDocumentId(id);
        return mapper.toDto(repository.save(entity));
    }

    public void delete(Long id) {
        repository.delete(findEntity(id));
    }

    private InstitutionVerificationDocument findEntity(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("InstitutionVerificationDocument not found: " + id));
    }
}

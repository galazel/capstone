package com.capstone.rebyu.partnership.service;

import com.capstone.rebyu.partnership.dto.InstitutionInvoiceDto;
import com.capstone.rebyu.partnership.entity.InstitutionInvoice;
import com.capstone.rebyu.partnership.mapper.InstitutionInvoiceMapper;
import com.capstone.rebyu.partnership.repository.InstitutionInvoiceRepository;
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
public class InstitutionInvoiceService {
    private final InstitutionInvoiceRepository repository;
    private final InstitutionInvoiceMapper mapper;

    public List<InstitutionInvoiceDto> getAll() {
        return repository.findAll().stream().map(mapper::toDto).toList();
    }

    public InstitutionInvoiceDto getById(Long id) {
        return mapper.toDto(findEntity(id));
    }

    public InstitutionInvoiceDto create(InstitutionInvoiceDto dto) {
        InstitutionInvoice entity = mapper.toEntity(dto);
        entity.setInstitutionInvoiceId(null);
        InstitutionInvoiceDto result = mapper.toDto(repository.save(entity));
        log.info("InstitutionInvoice created with id: {}", result.getInstitutionInvoiceId());
        return result;
    }

    public InstitutionInvoiceDto update(Long id, InstitutionInvoiceDto dto) {
        findEntity(id);
        InstitutionInvoice entity = mapper.toEntity(dto);
        entity.setInstitutionInvoiceId(id);
        return mapper.toDto(repository.save(entity));
    }

    public void delete(Long id) {
        repository.delete(findEntity(id));
    }

    private InstitutionInvoice findEntity(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("InstitutionInvoice not found: " + id));
    }
}

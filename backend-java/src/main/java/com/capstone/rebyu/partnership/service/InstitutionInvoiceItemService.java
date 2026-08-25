package com.capstone.rebyu.partnership.service;

import com.capstone.rebyu.partnership.dto.InstitutionInvoiceItemDto;
import com.capstone.rebyu.partnership.entity.InstitutionInvoiceItem;
import com.capstone.rebyu.partnership.mapper.InstitutionInvoiceItemMapper;
import com.capstone.rebyu.partnership.repository.InstitutionInvoiceItemRepository;
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
public class InstitutionInvoiceItemService {
    private final InstitutionInvoiceItemRepository repository;
    private final InstitutionInvoiceItemMapper mapper;

    public List<InstitutionInvoiceItemDto> getAll() {
        return repository.findAll().stream().map(mapper::toDto).toList();
    }

    public InstitutionInvoiceItemDto getById(Long id) {
        return mapper.toDto(findEntity(id));
    }

    public InstitutionInvoiceItemDto create(InstitutionInvoiceItemDto dto) {
        InstitutionInvoiceItem entity = mapper.toEntity(dto);
        entity.setInstitutionInvoiceItemId(null);
        InstitutionInvoiceItemDto result = mapper.toDto(repository.save(entity));
        log.info("InstitutionInvoiceItem created with id: {}", result.getInstitutionInvoiceItemId());
        return result;
    }

    public InstitutionInvoiceItemDto update(Long id, InstitutionInvoiceItemDto dto) {
        findEntity(id);
        InstitutionInvoiceItem entity = mapper.toEntity(dto);
        entity.setInstitutionInvoiceItemId(id);
        return mapper.toDto(repository.save(entity));
    }

    public void delete(Long id) {
        repository.delete(findEntity(id));
    }

    private InstitutionInvoiceItem findEntity(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("InstitutionInvoiceItem not found: " + id));
    }
}

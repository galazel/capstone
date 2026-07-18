package com.capstone.rebyu.partnership.service;

import com.capstone.rebyu.partnership.dto.PartnershipRequestDto;
import com.capstone.rebyu.partnership.mapper.PartnershipRequestMapper;
import com.capstone.rebyu.partnership.entity.PartnershipRequest;
import com.capstone.rebyu.partnership.repository.PartnershipRequestRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class PartnershipRequestService {
    private final PartnershipRequestRepository partnershipRequestRepository;
    private final PartnershipRequestMapper partnershipRequestMapper;

    public List<PartnershipRequestDto> getAll() {
        return partnershipRequestRepository.findAll().stream().map(partnershipRequestMapper::toDto).toList();
    }

    public PartnershipRequestDto getById(Long id) {
        return partnershipRequestMapper.toDto(findEntity(id));
    }

    public PartnershipRequestDto create(PartnershipRequestDto dto) {
        PartnershipRequest entity = partnershipRequestMapper.toEntity(dto);
        entity.setRequestId(null);
        return partnershipRequestMapper.toDto(partnershipRequestRepository.save(entity));
    }

    public PartnershipRequestDto update(Long id, PartnershipRequestDto dto) {
        PartnershipRequest existing = findEntity(id);
        PartnershipRequest entity = partnershipRequestMapper.toEntity(dto);
        entity.setRequestId(id);
        // Status transitions must only ever happen through AdminPartnershipService's
        // approve/reject workflow (which triggers the real Enterprise/certificate
        // side effects). Ignore any status the client sent on this generic CRUD
        // path so it can't be used to fake an approval without those side effects.
        entity.setStatus(existing.getStatus());
        return partnershipRequestMapper.toDto(partnershipRequestRepository.save(entity));
    }

    public void delete(Long id) {
        partnershipRequestRepository.delete(findEntity(id));
    }

    private PartnershipRequest findEntity(Long id) {
        return partnershipRequestRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("PartnershipRequest not found: " + id));
    }
}

package com.capstone.rebyu.partnership.service;

import com.capstone.rebyu.partnership.dto.InstitutionCertificationRenewalRequestDto;
import com.capstone.rebyu.partnership.entity.InstitutionCertificationRenewalRequest;
import com.capstone.rebyu.partnership.mapper.InstitutionCertificationRenewalRequestMapper;
import com.capstone.rebyu.partnership.repository.InstitutionCertificationRenewalRequestRepository;
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
public class InstitutionCertificationRenewalRequestService {
    private final InstitutionCertificationRenewalRequestRepository renewalRequestRepository;
    private final InstitutionCertificationRenewalRequestMapper renewalRequestMapper;

    public List<InstitutionCertificationRenewalRequestDto> getAll() {
        log.debug("Fetching all institution certification renewal requests");
        return renewalRequestRepository.findAll().stream().map(renewalRequestMapper::toDto).toList();
    }

    public List<InstitutionCertificationRenewalRequestDto> getByOrgCertId(Long orgCertId) {
        log.debug("Fetching renewal requests for orgCertId: {}", orgCertId);
        return renewalRequestRepository.findByOrgCert_OrgCertId(orgCertId)
                .stream().map(renewalRequestMapper::toDto).toList();
    }

    public InstitutionCertificationRenewalRequestDto getById(Long id) {
        log.debug("Fetching renewal request id: {}", id);
        return renewalRequestMapper.toDto(findEntity(id));
    }

    public InstitutionCertificationRenewalRequestDto create(InstitutionCertificationRenewalRequestDto dto) {
        log.info("Creating new institution certification renewal request");
        InstitutionCertificationRenewalRequest entity = renewalRequestMapper.toEntity(dto);
        entity.setRenewalRequestId(null);
        InstitutionCertificationRenewalRequestDto result = renewalRequestMapper.toDto(renewalRequestRepository.save(entity));
        log.info("InstitutionCertificationRenewalRequest created with id: {}", result.getRenewalRequestId());
        return result;
    }

    public InstitutionCertificationRenewalRequestDto update(Long id, InstitutionCertificationRenewalRequestDto dto) {
        log.info("Updating renewal request id: {}", id);
        findEntity(id);
        InstitutionCertificationRenewalRequest entity = renewalRequestMapper.toEntity(dto);
        entity.setRenewalRequestId(id);
        InstitutionCertificationRenewalRequestDto result = renewalRequestMapper.toDto(renewalRequestRepository.save(entity));
        log.info("InstitutionCertificationRenewalRequest id: {} updated", id);
        return result;
    }

    public void delete(Long id) {
        log.info("Deleting renewal request id: {}", id);
        renewalRequestRepository.delete(findEntity(id));
        log.info("InstitutionCertificationRenewalRequest id: {} deleted", id);
    }

    private InstitutionCertificationRenewalRequest findEntity(Long id) {
        return renewalRequestRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("InstitutionCertificationRenewalRequest not found: " + id));
    }
}

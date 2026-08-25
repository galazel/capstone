package com.capstone.rebyu.organization.service;

import com.capstone.rebyu.organization.dto.InstitutionDto;
import com.capstone.rebyu.organization.mapper.InstitutionMapper;
import com.capstone.rebyu.organization.entity.Institution;
import com.capstone.rebyu.organization.repository.InstitutionRepository;
import com.capstone.rebyu.organization.repository.OrganizationCertificateRepository;
import com.capstone.rebyu.enrollment.repository.OrganizationCertificationLearnerRepository;
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
public class InstitutionService {
    private final InstitutionRepository institutionRepository;
    private final InstitutionMapper institutionMapper;
    private final OrganizationCertificateRepository organizationCertificateRepository;
    private final OrganizationCertificationLearnerRepository organizationCertificationLearnerRepository;

    public List<InstitutionDto> getAll() {
        log.debug("Fetching all institutions");
        return institutionRepository.findAll().stream()
                .map(this::toDtoWithAggregates)
                .toList();
    }

    public InstitutionDto getById(Long id) {
        log.debug("Fetching institution id: {}", id);
        return toDtoWithAggregates(findEntity(id));
    }

    /**
     * The mapper only carries the entity's own columns; the admin list also
     * needs learner/certification counts and a status, none of which exist on
     * Institution itself.
     */
    private InstitutionDto toDtoWithAggregates(Institution entity) {
        InstitutionDto dto = institutionMapper.toDto(entity);
        dto.setCertificationCount(
                organizationCertificateRepository.findByInstitution_InstitutionId(entity.getInstitutionId()).size());
        long learnerCount = organizationCertificationLearnerRepository
                .findByOrgCert_Institution_InstitutionId(entity.getInstitutionId())
                .stream()
                .map(l -> l.getLearner().getLearnerId())
                .distinct()
                .count();
        dto.setLearnerCount((int) learnerCount);
        dto.setStatus(entity.isVerified() ? "active" : "pending");
        return dto;
    }

    public InstitutionDto create(InstitutionDto dto) {
        log.info("Creating new institution");
        Institution entity = institutionMapper.toEntity(dto);
        entity.setInstitutionId(null);
        InstitutionDto result = institutionMapper.toDto(institutionRepository.save(entity));
        log.info("Institution created with id: {}", result.getInstitutionId());
        return result;
    }

    public InstitutionDto update(Long id, InstitutionDto dto) {
        log.info("Updating institution id: {}", id);
        findEntity(id);
        Institution entity = institutionMapper.toEntity(dto);
        entity.setInstitutionId(id);
        InstitutionDto result = institutionMapper.toDto(institutionRepository.save(entity));
        log.info("Institution id: {} updated", id);
        return result;
    }

    public void delete(Long id) {
        log.info("Deleting institution id: {}", id);
        institutionRepository.delete(findEntity(id));
        log.info("Institution id: {} deleted", id);
    }

    private Institution findEntity(Long id) {
        return institutionRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Institution not found: " + id));
    }
}

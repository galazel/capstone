package com.capstone.rebyu.organization.service;

import com.capstone.rebyu.organization.dto.InstitutionMemberDto;
import com.capstone.rebyu.organization.entity.InstitutionMember;
import com.capstone.rebyu.organization.mapper.InstitutionMemberMapper;
import com.capstone.rebyu.organization.repository.InstitutionMemberRepository;
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
public class InstitutionMemberService {
    private final InstitutionMemberRepository institutionMemberRepository;
    private final InstitutionMemberMapper institutionMemberMapper;

    public List<InstitutionMemberDto> getAll() {
        log.debug("Fetching all institution members");
        return institutionMemberRepository.findAll().stream().map(institutionMemberMapper::toDto).toList();
    }

    public List<InstitutionMemberDto> getByInstitutionId(Long institutionId) {
        log.debug("Fetching members for institutionId: {}", institutionId);
        return institutionMemberRepository.findByInstitution_InstitutionId(institutionId)
                .stream().map(institutionMemberMapper::toDto).toList();
    }

    public InstitutionMemberDto getById(Long id) {
        log.debug("Fetching institution member id: {}", id);
        return institutionMemberMapper.toDto(findEntity(id));
    }

    public InstitutionMemberDto create(InstitutionMemberDto dto) {
        log.info("Creating new institution member");
        InstitutionMember entity = institutionMemberMapper.toEntity(dto);
        entity.setInstitutionMemberId(null);
        InstitutionMemberDto result = institutionMemberMapper.toDto(institutionMemberRepository.save(entity));
        log.info("InstitutionMember created with id: {}", result.getInstitutionMemberId());
        return result;
    }

    public InstitutionMemberDto update(Long id, InstitutionMemberDto dto) {
        log.info("Updating institution member id: {}", id);
        findEntity(id);
        InstitutionMember entity = institutionMemberMapper.toEntity(dto);
        entity.setInstitutionMemberId(id);
        InstitutionMemberDto result = institutionMemberMapper.toDto(institutionMemberRepository.save(entity));
        log.info("InstitutionMember id: {} updated", id);
        return result;
    }

    public void delete(Long id) {
        log.info("Deleting institution member id: {}", id);
        institutionMemberRepository.delete(findEntity(id));
        log.info("InstitutionMember id: {} deleted", id);
    }

    private InstitutionMember findEntity(Long id) {
        return institutionMemberRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("InstitutionMember not found: " + id));
    }
}

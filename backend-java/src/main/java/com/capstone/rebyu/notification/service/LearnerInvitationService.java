package com.capstone.rebyu.notification.service;

import com.capstone.rebyu.notification.dto.LearnerInvitationDto;
import com.capstone.rebyu.notification.mapper.LearnerInvitationMapper;
import com.capstone.rebyu.notification.entity.LearnerInvitation;
import com.capstone.rebyu.notification.repository.LearnerInvitationRepository;
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
public class LearnerInvitationService {
    private final LearnerInvitationRepository learnerInvitationRepository;
    private final LearnerInvitationMapper learnerInvitationMapper;

    public List<LearnerInvitationDto> getAll() {
        log.debug("Fetching all learner invitations");
        return learnerInvitationRepository.findAll().stream().map(learnerInvitationMapper::toDto).toList();
    }

    public LearnerInvitationDto getById(Long id) {
        log.debug("Fetching learner invitation id: {}", id);
        return learnerInvitationMapper.toDto(findEntity(id));
    }

    private LearnerInvitation findEntity(Long id) {
        return learnerInvitationRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("LearnerInvitation not found: " + id));
    }
}

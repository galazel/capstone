package com.capstone.rebyu.progress.service;

import com.capstone.rebyu.progress.dto.LearnerAchievementDto;
import com.capstone.rebyu.progress.mapper.LearnerAchievementMapper;
import com.capstone.rebyu.progress.entity.LearnerAchievement;
import com.capstone.rebyu.progress.entity.LearnerAchievementId;
import com.capstone.rebyu.progress.entity.Achievement;
import com.capstone.rebyu.progress.repository.LearnerAchievementRepository;
import com.capstone.rebyu.user.entity.Learner;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class LearnerAchievementService {
    private final LearnerAchievementRepository learnerAchievementRepository;
    private final LearnerAchievementMapper learnerAchievementMapper;
    private final EntityManager entityManager;

    public List<LearnerAchievementDto> getAll() {
        return learnerAchievementRepository.findAll().stream().map(learnerAchievementMapper::toDto).toList();
    }

    public LearnerAchievementDto getById(Long learnerId, Long achievementId) {
        return learnerAchievementMapper.toDto(findEntity(learnerId, achievementId));
    }

    public LearnerAchievementDto create(LearnerAchievementDto dto) {
        return learnerAchievementMapper.toDto(learnerAchievementRepository.save(toEntity(dto)));
    }

    public LearnerAchievementDto update(Long learnerId, Long achievementId, LearnerAchievementDto dto) {
        findEntity(learnerId, achievementId);
        dto.setLearnerId(learnerId);
        dto.setAchievementId(achievementId);
        return learnerAchievementMapper.toDto(learnerAchievementRepository.save(toEntity(dto)));
    }

    /**
     * The mapper only fills the {@code @EmbeddedId}; the {@code @MapsId}
     * associations still need their own reference or Hibernate NPEs resolving
     * the id from a null learner/achievement at flush time -- the same fix
     * already in LearnerCompletedLessonService and LearnerReadSectionService.
     */
    private LearnerAchievement toEntity(LearnerAchievementDto dto) {
        LearnerAchievement entity = learnerAchievementMapper.toEntity(dto);
        entity.setLearner(entityManager.getReference(Learner.class, dto.getLearnerId()));
        entity.setAchievement(entityManager.getReference(Achievement.class, dto.getAchievementId()));
        return entity;
    }

    public void delete(Long learnerId, Long achievementId) {
        learnerAchievementRepository.delete(findEntity(learnerId, achievementId));
    }

    private LearnerAchievement findEntity(Long learnerId, Long achievementId) {
        LearnerAchievementId id = new LearnerAchievementId();
        id.setLearnerId(learnerId);
        id.setAchievementId(achievementId);
        return learnerAchievementRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("LearnerAchievement not found: " + learnerId + "/" + achievementId));
    }
}

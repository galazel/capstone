package com.capstone.rebyu.progress.service;

import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.gamification.RewardService;
import com.capstone.rebyu.gamification.service.StreakService;
import com.capstone.rebyu.progress.dto.LearnerCompletedLessonDto;
import com.capstone.rebyu.progress.mapper.LearnerCompletedLessonMapper;
import com.capstone.rebyu.progress.entity.LearnerCompletedLesson;
import com.capstone.rebyu.progress.entity.LearnerCompletedLessonId;
import com.capstone.rebyu.progress.repository.LearnerCompletedLessonRepository;
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
public class LearnerCompletedLessonService {
    private static final int LESSON_COMPLETION_XP = 100;

    private final LearnerCompletedLessonRepository learnerCompletedLessonRepository;
    private final LearnerCompletedLessonMapper learnerCompletedLessonMapper;
    private final EntityManager entityManager;
    private final RewardService rewardService;
    private final StreakService streakService;

    public List<LearnerCompletedLessonDto> getAll() {
        return learnerCompletedLessonRepository.findAll().stream().map(learnerCompletedLessonMapper::toDto).toList();
    }

    public LearnerCompletedLessonDto getById(Long learnerId, Long lessonId) {
        return learnerCompletedLessonMapper.toDto(findEntity(learnerId, lessonId));
    }

    public LearnerCompletedLessonDto create(LearnerCompletedLessonDto dto) {
        LearnerCompletedLesson entity = learnerCompletedLessonMapper.toEntity(dto);
        // The mapper only fills the `@EmbeddedId`; the `@MapsId` associations
        // below still need their own reference or Hibernate NPEs resolving the
        // id from a null `learner`/`lesson` at flush time (see the identical
        // fix already in LearnerReadSectionService).
        entity.setLearner(entityManager.getReference(Learner.class, dto.getLearnerId()));
        entity.setLesson(entityManager.getReference(Lesson.class, dto.getLessonId()));
        LearnerCompletedLessonDto saved = learnerCompletedLessonMapper.toDto(learnerCompletedLessonRepository.save(entity));

        // Keyed by lessonId, not a timestamp: a lesson re-marked complete (the
        // composite PK makes `create` an upsert) must not re-pay XP.
        rewardService.awardXp(dto.getLearnerId(), LESSON_COMPLETION_XP, "LESSON_COMPLETED",
                "lesson-completed:" + dto.getLessonId());
        streakService.recordActivity(dto.getLearnerId());

        return saved;
    }

    public LearnerCompletedLessonDto update(Long learnerId, Long lessonId, LearnerCompletedLessonDto dto) {
        findEntity(learnerId, lessonId);
        dto.setLearnerId(learnerId);
        dto.setLessonId(lessonId);
        LearnerCompletedLesson entity = learnerCompletedLessonMapper.toEntity(dto);
        entity.setLearner(entityManager.getReference(Learner.class, learnerId));
        entity.setLesson(entityManager.getReference(Lesson.class, lessonId));
        return learnerCompletedLessonMapper.toDto(learnerCompletedLessonRepository.save(entity));
    }

    public void delete(Long learnerId, Long lessonId) {
        learnerCompletedLessonRepository.delete(findEntity(learnerId, lessonId));
    }

    private LearnerCompletedLesson findEntity(Long learnerId, Long lessonId) {
        LearnerCompletedLessonId id = new LearnerCompletedLessonId();
        id.setLearnerId(learnerId);
        id.setLessonId(lessonId);
        return learnerCompletedLessonRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("LearnerCompletedLesson not found: " + learnerId + "/" + lessonId));
    }
}

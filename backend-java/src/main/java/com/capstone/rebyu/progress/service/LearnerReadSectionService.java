package com.capstone.rebyu.progress.service;

import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.progress.entity.LearnerReadSection;
import com.capstone.rebyu.progress.entity.LearnerReadSectionId;
import com.capstone.rebyu.progress.repository.LearnerReadSectionRepository;
import com.capstone.rebyu.user.entity.Learner;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class LearnerReadSectionService {
    private final LearnerReadSectionRepository readSectionRepository;
    private final EntityManager entityManager;

    public List<String> listReadSectionKeys(Long learnerId, Long lessonId) {
        return readSectionRepository.findByLearner_LearnerIdAndLesson_LessonId(learnerId, lessonId)
                .stream()
                .map(entity -> entity.getId().getSectionKey())
                .toList();
    }

    // Idempotent by design: the lesson's scroll check calls this every time a
    // section's sentinel crosses the fold, not just the first time.
    public void markRead(Long learnerId, Long lessonId, String sectionKey) {
        LearnerReadSectionId id = new LearnerReadSectionId();
        id.setLearnerId(learnerId);
        id.setLessonId(lessonId);
        id.setSectionKey(sectionKey);

        if (readSectionRepository.existsById(id)) {
            return;
        }

        LearnerReadSection entity = LearnerReadSection.builder()
                .id(id)
                .learner(entityManager.getReference(Learner.class, learnerId))
                .lesson(entityManager.getReference(Lesson.class, lessonId))
                .readAt(LocalDateTime.now())
                .build();

        readSectionRepository.save(entity);
    }

    public void markUnread(Long learnerId, Long lessonId, String sectionKey) {
        readSectionRepository.deleteByLearner_LearnerIdAndLesson_LessonIdAndId_SectionKey(learnerId, lessonId, sectionKey);
    }
}

package com.capstone.rebyu.progress.repository;

import com.capstone.rebyu.progress.entity.LearnerReadSection;
import com.capstone.rebyu.progress.entity.LearnerReadSectionId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LearnerReadSectionRepository extends JpaRepository<LearnerReadSection, LearnerReadSectionId> {

    List<LearnerReadSection> findByLearner_LearnerIdAndLesson_LessonId(Long learnerId, Long lessonId);

    void deleteByLearner_LearnerIdAndLesson_LessonIdAndId_SectionKey(Long learnerId, Long lessonId, String sectionKey);
}

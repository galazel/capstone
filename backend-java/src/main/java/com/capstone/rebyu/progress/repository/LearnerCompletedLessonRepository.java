package com.capstone.rebyu.progress.repository;

import com.capstone.rebyu.progress.entity.LearnerCompletedLesson;
import com.capstone.rebyu.progress.entity.LearnerCompletedLessonId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LearnerCompletedLessonRepository extends JpaRepository<LearnerCompletedLesson, LearnerCompletedLessonId> {

    List<LearnerCompletedLesson> findByLearner_LearnerIdAndLesson_MiddleCategory_MajorCategory_Certification_CertificationId(
            Long learnerId, Long certificationId);

    List<LearnerCompletedLesson> findByLearner_LearnerId(Long learnerId);
}

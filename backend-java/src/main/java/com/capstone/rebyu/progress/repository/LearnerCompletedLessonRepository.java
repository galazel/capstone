package com.capstone.rebyu.progress.repository;

import com.capstone.rebyu.progress.entity.LearnerCompletedLesson;
import com.capstone.rebyu.progress.entity.LearnerCompletedLessonId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LearnerCompletedLessonRepository extends JpaRepository<LearnerCompletedLesson, LearnerCompletedLessonId> {

    List<LearnerCompletedLesson> findByLearner_LearnerIdAndLesson_MiddleCategory_MajorCategory_Certification_CertificationId(
            Long learnerId, Long certificationId);

    List<LearnerCompletedLesson> findByLearner_LearnerId(Long learnerId);

    /** Lessons finished per learner, for a whole roster at once. */
    interface LessonsDone {
        Long getLearnerId();
        long getLessonsCompleted();
    }

    @org.springframework.data.jpa.repository.Query("""
            SELECT l.learner.learnerId AS learnerId, COUNT(l) AS lessonsCompleted
            FROM LearnerCompletedLesson l
            WHERE l.learner.learnerId IN :learnerIds
            GROUP BY l.learner.learnerId
            """)
    List<LessonsDone> lessonsCompletedByLearnerIds(
            @org.springframework.data.repository.query.Param("learnerIds") java.util.Collection<Long> learnerIds);
}

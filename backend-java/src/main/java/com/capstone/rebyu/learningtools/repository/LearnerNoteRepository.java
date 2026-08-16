package com.capstone.rebyu.learningtools.repository;

import com.capstone.rebyu.learningtools.entity.LearnerNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface LearnerNoteRepository extends JpaRepository<LearnerNote, Long> {

    /** Oldest first: a checklist reads in the order it was written. */
    List<LearnerNote> findByLearner_LearnerIdAndCertificationIdOrderByCreatedAtAsc(
            Long learnerId, Long certificationId);

    /**
     * Clear-all and clear-completed in one statement each. Deleting row by row
     * from the browser leaves a half-cleared list behind whenever one request
     * fails, which is exactly what "clear all" must not do.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM LearnerNote n WHERE n.learner.learnerId = :learnerId "
            + "AND n.certificationId = :certificationId")
    int deleteAllForLearnerAndCertification(
            @Param("learnerId") Long learnerId, @Param("certificationId") Long certificationId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM LearnerNote n WHERE n.learner.learnerId = :learnerId "
            + "AND n.certificationId = :certificationId AND n.done = TRUE")
    int deleteCompletedForLearnerAndCertification(
            @Param("learnerId") Long learnerId, @Param("certificationId") Long certificationId);
}

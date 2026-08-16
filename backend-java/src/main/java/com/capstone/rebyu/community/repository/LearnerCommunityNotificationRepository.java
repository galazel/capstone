package com.capstone.rebyu.community.repository;

import com.capstone.rebyu.community.entity.LearnerCommunityNotification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;

public interface LearnerCommunityNotificationRepository extends JpaRepository<LearnerCommunityNotification, Long> {

    List<LearnerCommunityNotification> findTop20ByLearner_LearnerIdOrderByCreatedAtDesc(Long learnerId);

    /**
     * Guards against re-notifying for the same upvote. Un-liking and liking again
     * is one person's opinion changing, not two events worth telling the author
     * about twice.
     */
    boolean existsByLearner_LearnerIdAndTitleAndBody(Long learnerId, String title, String body);

    /**
     * Bulk mark-as-read / clear-all, mirroring NotificationRepository. The bell
     * merges this feed with the generic inbox one, so "mark all read" and
     * "clear all" have to be able to reach both sides -- doing it row by row
     * from the browser left rows behind whenever one request failed.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE LearnerCommunityNotification n SET n.readAt = :readAt "
            + "WHERE n.learner.learnerId = :learnerId AND n.readAt IS NULL")
    int markAllReadForLearner(@Param("learnerId") Long learnerId, @Param("readAt") OffsetDateTime readAt);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM LearnerCommunityNotification n WHERE n.learner.learnerId = :learnerId")
    int deleteAllForLearner(@Param("learnerId") Long learnerId);
}

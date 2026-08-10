package com.capstone.rebyu.community.repository;

import com.capstone.rebyu.community.entity.LearnerCommunityNotification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LearnerCommunityNotificationRepository extends JpaRepository<LearnerCommunityNotification, Long> {

    List<LearnerCommunityNotification> findTop20ByLearner_LearnerIdOrderByCreatedAtDesc(Long learnerId);

    /**
     * Guards against re-notifying for the same upvote. Un-liking and liking again
     * is one person's opinion changing, not two events worth telling the author
     * about twice.
     */
    boolean existsByLearner_LearnerIdAndTitleAndBody(Long learnerId, String title, String body);
}

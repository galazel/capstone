package com.capstone.rebyu.community.repository;

import com.capstone.rebyu.community.entity.LearnerCommunityNotification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LearnerCommunityNotificationRepository extends JpaRepository<LearnerCommunityNotification, Long> {

    List<LearnerCommunityNotification> findTop20ByLearner_LearnerIdOrderByCreatedAtDesc(Long learnerId);
}

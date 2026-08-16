package com.capstone.rebyu.progress.repository;

import com.capstone.rebyu.progress.entity.LearnerAchievement;
import com.capstone.rebyu.progress.entity.LearnerAchievementId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LearnerAchievementRepository extends JpaRepository<LearnerAchievement, LearnerAchievementId> {

    /** Everything this learner has already unlocked, newest first. */
    List<LearnerAchievement> findById_LearnerIdOrderByEarnedAtDesc(Long learnerId);
}

package com.capstone.rebyu.learningtools.repository;

import com.capstone.rebyu.learningtools.entity.LearnerDashboardLayout;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface LearnerDashboardLayoutRepository extends JpaRepository<LearnerDashboardLayout, Long> {

    Optional<LearnerDashboardLayout> findByLearner_LearnerId(Long learnerId);
}

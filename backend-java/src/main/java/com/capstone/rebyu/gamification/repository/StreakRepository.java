package com.capstone.rebyu.gamification.repository;

import com.capstone.rebyu.gamification.entity.Streak;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface StreakRepository extends JpaRepository<Streak, Long> {
  Optional<Streak> findByLearner_LearnerId(Long learnerId);
}

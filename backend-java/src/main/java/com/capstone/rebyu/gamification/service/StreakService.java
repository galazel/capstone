package com.capstone.rebyu.gamification.service;

import com.capstone.rebyu.gamification.entity.Streak;
import com.capstone.rebyu.gamification.repository.StreakRepository;
import com.capstone.rebyu.user.entity.Learner;
import com.capstone.rebyu.user.repository.LearnerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.List;

@Service
public class StreakService {
  @Autowired private StreakRepository streakRepository;
  @Autowired private LearnerRepository learnerRepository;

  @Transactional
  public void recordActivity(Long learnerId) {
    Learner learner = learnerRepository.findById(learnerId).orElseThrow();
    Streak streak = streakRepository.findByLearner_LearnerId(learnerId)
        .orElseGet(() -> {
          Streak s = new Streak();
          s.setLearner(learner);
          return s;
        });

    LocalDate today = LocalDate.now();
    if (streak.getLastActivityDate() == null) {
      streak.setCurrentStreak(1);
      streak.setStreakStartDate(today);
    } else if (streak.getLastActivityDate().equals(today)) {
      // Already recorded today
      return;
    } else if (streak.getLastActivityDate().plusDays(1).equals(today)) {
      // Consecutive day
      streak.setCurrentStreak(streak.getCurrentStreak() + 1);
      if (streak.getCurrentStreak() > streak.getBestStreak()) {
        streak.setBestStreak(streak.getCurrentStreak());
      }
    } else {
      // Streak broken
      streak.setCurrentStreak(1);
      streak.setStreakStartDate(today);
    }
    streak.setLastActivityDate(today);
    streakRepository.save(streak);
  }

  public record StreakView(int currentStreak, int bestStreak, LocalDate lastActivityDate, LocalDate streakStartDate) {}

  /**
   * A DTO, not the entity: {@code Streak.learner} is a lazy {@code @OneToOne}
   * to {@code Learner} (whose own {@code user} is lazy too), and with
   * `open-in-view: false` the Hibernate session is closed before Jackson
   * would serialize the controller's response -- returning the entity graph
   * directly threw `LazyInitializationException` on every learner who already
   * had a streak row, surfacing as a 500 from the catch-all handler.
   */
  public StreakView getStreak(Long learnerId) {
    Streak streak = streakRepository.findByLearner_LearnerId(learnerId).orElse(new Streak());
    return new StreakView(
        streak.getCurrentStreak() == null ? 0 : streak.getCurrentStreak(),
        streak.getBestStreak() == null ? 0 : streak.getBestStreak(),
        streak.getLastActivityDate(),
        streak.getStreakStartDate());
  }

  public List<Streak> topStreaks(int limit) {
    return streakRepository.findAll().stream()
        .sorted((a, b) -> b.getCurrentStreak().compareTo(a.getCurrentStreak()))
        .limit(limit)
        .toList();
  }
}

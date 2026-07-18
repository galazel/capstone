package com.capstone.rebyu.gamification.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.gamification.entity.NotificationPreference;
import com.capstone.rebyu.gamification.repository.NotificationPreferenceRepository;
import com.capstone.rebyu.user.entity.Learner;
import com.capstone.rebyu.user.repository.LearnerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.preauthorize.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notification-preferences")
public class NotificationPreferenceController {
  @Autowired private NotificationPreferenceRepository prefRepository;
  @Autowired private LearnerRepository learnerRepository;

  @GetMapping("/me")
  @PreAuthorize("hasRole('LEARNER')")
  public ResponseEntity<NotificationPreference> getPreferences(
      @RequestAttribute CurrentUserDto currentUser) {
    var pref = prefRepository.findByLearner_LearnerId(currentUser.getLearnerId())
        .orElseGet(() -> {
          Learner learner = learnerRepository.findById(currentUser.getLearnerId()).orElseThrow();
          NotificationPreference p = new NotificationPreference();
          p.setLearner(learner);
          return prefRepository.save(p);
        });
    return ResponseEntity.ok(pref);
  }

  @PutMapping("/me")
  @PreAuthorize("hasRole('LEARNER')")
  public ResponseEntity<NotificationPreference> updatePreferences(
      @RequestBody NotificationPreference request,
      @RequestAttribute CurrentUserDto currentUser) {
    var pref = prefRepository.findByLearner_LearnerId(currentUser.getLearnerId())
        .orElseGet(() -> {
          Learner learner = learnerRepository.findById(currentUser.getLearnerId()).orElseThrow();
          NotificationPreference p = new NotificationPreference();
          p.setLearner(learner);
          return p;
        });

    pref.setDailyReminder(request.getDailyReminder());
    pref.setDailyReminderTime(request.getDailyReminderTime());
    pref.setStreakReminder(request.getStreakReminder());
    pref.setSocialNotifications(request.getSocialNotifications());
    pref.setAchievementNotifications(request.getAchievementNotifications());

    return ResponseEntity.ok(prefRepository.save(pref));
  }
}

package com.capstone.rebyu.community.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.community.service.CommunityNotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.preauthorize.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/community/notifications")
public class CommunityNotificationController {

  @Autowired
  private CommunityNotificationService notificationService;

  @GetMapping
  @PreAuthorize("hasRole('LEARNER')")
  public ResponseEntity<?> getNotifications(@RequestAttribute CurrentUserDto currentUser) {
    return ResponseEntity.ok(notificationService.getNotifications(currentUser.getLearnerId()));
  }

  @PutMapping("/{id}/read")
  @PreAuthorize("hasRole('LEARNER')")
  public ResponseEntity<?> markAsRead(
      @PathVariable Long id,
      @RequestAttribute CurrentUserDto currentUser) {
    notificationService.markAsRead(id, currentUser.getLearnerId());
    return ResponseEntity.ok().build();
  }
}

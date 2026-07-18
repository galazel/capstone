package com.capstone.rebyu.community.service;

import com.capstone.rebyu.community.repository.CommunityPostRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Map;

@Service
public class CommunityNotificationService {

  @Autowired
  private CommunityPostRepository postRepository;

  public List<?> getNotifications(Long learnerId) {
    // Fetch notifications for learner (stub - returns empty for now)
    return List.of();
  }

  public void markAsRead(Long notificationId, Long learnerId) {
    // Mark notification as read
  }
}

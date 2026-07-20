package com.capstone.rebyu.notification.repository;

import com.capstone.rebyu.notification.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findTop20ByUser_UserIdOrderByCreatedAtDesc(Long userId);
}

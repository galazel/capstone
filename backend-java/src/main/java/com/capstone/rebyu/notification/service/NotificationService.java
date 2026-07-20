package com.capstone.rebyu.notification.service;

import com.capstone.rebyu.notification.entity.Notification;
import com.capstone.rebyu.notification.repository.NotificationRepository;
import com.capstone.rebyu.user.entity.User;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Generic in-app notifications for any role (ADMIN/ENTERPRISE/LEARNER) --
 * the partnership-request and invitation lifecycle events all land here.
 * Deliberately parallel to community.CommunityService's learner-only
 * notification methods rather than merged with them, since those are
 * scoped to Learner (not User) and back a different table.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public record NotificationDto(
            Long id, String title, String body, String href, OffsetDateTime createdAt, boolean read) {
    }

    /** Fire-and-forget: a notification is a side effect, never a reason to fail the caller's own action. */
    public void notify(User user, String title, String body, String href) {
        if (user == null) {
            return;
        }
        notificationRepository.save(Notification.builder()
                .user(user)
                .title(title)
                .body(body)
                .href(href)
                .build());
    }

    @Transactional(readOnly = true)
    public List<NotificationDto> forUser(Long userId) {
        return notificationRepository.findTop20ByUser_UserIdOrderByCreatedAtDesc(userId).stream()
                .map(n -> new NotificationDto(
                        n.getNotificationId(), n.getTitle(), n.getBody(), n.getHref(),
                        n.getCreatedAt(), n.getReadAt() != null))
                .toList();
    }

    public void markRead(Long userId, Long notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new EntityNotFoundException("Notification not found: " + notificationId));
        if (!notification.getUser().getUserId().equals(userId)) {
            throw new EntityNotFoundException("Notification not found: " + notificationId);
        }
        if (notification.getReadAt() == null) {
            notification.setReadAt(OffsetDateTime.now());
            notificationRepository.save(notification);
        }
    }
}

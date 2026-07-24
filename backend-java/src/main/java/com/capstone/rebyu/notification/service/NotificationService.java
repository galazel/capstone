package com.capstone.rebyu.notification.service;

import com.capstone.rebyu.notification.entity.Notification;
import com.capstone.rebyu.notification.repository.NotificationRepository;
import com.capstone.rebyu.user.entity.User;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

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
    private final NotificationStreamService streamService;

    public record NotificationDto(
            Long id, String title, String body, String href, OffsetDateTime createdAt, boolean read) {
    }

    /** Fire-and-forget: a notification is a side effect, never a reason to fail the caller's own action. */
    public void notify(User user, String title, String body, String href) {
        if (user == null) {
            return;
        }
        Notification saved = notificationRepository.save(Notification.builder()
                .user(user)
                .title(title)
                .body(body)
                .href(href)
                .build());

        pushAfterCommit(user.getUserId(), toDto(saved));
    }

    /**
     * Live-pushes only once the surrounding transaction actually commits. Several
     * callers create a notification partway through work that can still roll back
     * (an invitation whose e-mail send fails, for one) -- pushing inline would
     * announce an event to the browser that the database then discarded.
     */
    private void pushAfterCommit(Long userId, NotificationDto dto) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            streamService.push(userId, dto);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                streamService.push(userId, dto);
            }
        });
    }

    /** The user's whole feed, newest first. */
    @Transactional(readOnly = true)
    public List<NotificationDto> forUser(Long userId) {
        return notificationRepository.findByUser_UserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public long unreadCount(Long userId) {
        return notificationRepository.countByUser_UserIdAndReadAtIsNull(userId);
    }

    public void markRead(Long userId, Long notificationId) {
        Notification notification = requireOwned(userId, notificationId);
        if (notification.getReadAt() == null) {
            notification.setReadAt(OffsetDateTime.now());
            notificationRepository.save(notification);
        }
    }

    public int markAllRead(Long userId) {
        return notificationRepository.markAllReadForUser(userId, OffsetDateTime.now());
    }

    public void delete(Long userId, Long notificationId) {
        notificationRepository.delete(requireOwned(userId, notificationId));
    }

    public int deleteAll(Long userId) {
        return notificationRepository.deleteAllForUser(userId);
    }

    /**
     * Another user's notification is reported as simply not found, so an id probe
     * can't confirm that a given notification exists.
     */
    private Notification requireOwned(Long userId, Long notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new EntityNotFoundException("Notification not found: " + notificationId));
        if (!notification.getUser().getUserId().equals(userId)) {
            throw new EntityNotFoundException("Notification not found: " + notificationId);
        }
        return notification;
    }

    private NotificationDto toDto(Notification n) {
        return new NotificationDto(
                n.getNotificationId(), n.getTitle(), n.getBody(), n.getHref(),
                n.getCreatedAt(), n.getReadAt() != null);
    }
}

package com.capstone.rebyu.enterprisegroup.service;

import com.capstone.rebyu.enterprisegroup.dto.GroupAnnouncementDto;
import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroup;
import com.capstone.rebyu.enterprisegroup.entity.GroupAnnouncement;
import com.capstone.rebyu.enterprisegroup.repository.EnterpriseGroupRepository;
import com.capstone.rebyu.enterprisegroup.repository.GroupAnnouncementRepository;
import com.capstone.rebyu.user.entity.User;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Group-owned announcements. Access reuses {@link EnterpriseGroupService}'s
 * scoping: the caller must be the institution owner or an active authority
 * (leader) of the target group, enforced by {@code getAccessibleById}, which
 * reports "not found" for any group the caller can't act on.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class GroupAnnouncementService {

    private final GroupAnnouncementRepository groupAnnouncementRepository;
    private final EnterpriseGroupRepository enterpriseGroupRepository;
    private final EnterpriseGroupService enterpriseGroupService;

    @Transactional(readOnly = true)
    public List<GroupAnnouncementDto> list(Long groupId, Long enterpriseId, Long userId, boolean owner) {
        // Access check (throws if the caller can't act on this group).
        enterpriseGroupService.getAccessibleById(groupId, enterpriseId, userId, owner);
        return groupAnnouncementRepository
                .findByEnterpriseGroup_EnterpriseGroupIdAndStatusOrderByPinnedDescCreatedAtDesc(
                        groupId, GroupAnnouncement.Status.active)
                .stream().map(this::toDto).toList();
    }

    public GroupAnnouncementDto create(
            Long groupId, GroupAnnouncementDto dto, Long enterpriseId, Long userId, boolean owner) {
        enterpriseGroupService.getAccessibleById(groupId, enterpriseId, userId, owner);
        EnterpriseGroup group = enterpriseGroupRepository.findById(groupId)
                .orElseThrow(() -> new EntityNotFoundException("EnterpriseGroup not found: " + groupId));

        GroupAnnouncement entity = GroupAnnouncement.builder()
                .enterpriseGroup(group)
                .title(dto.getTitle().trim())
                .body(dto.getBody())
                .pinned(dto.isPinned())
                .createdBy(User.builder().userId(userId).build())
                .createdAt(LocalDateTime.now())
                .status(GroupAnnouncement.Status.active)
                .build();
        GroupAnnouncementDto result = toDto(groupAnnouncementRepository.save(entity));
        log.info("Group {} announcement created (id={}) by userId={}",
                groupId, result.getGroupAnnouncementId(), userId);
        return result;
    }

    public GroupAnnouncementDto update(
            Long groupId, Long announcementId, GroupAnnouncementDto dto,
            Long enterpriseId, Long userId, boolean owner) {
        enterpriseGroupService.getAccessibleById(groupId, enterpriseId, userId, owner);
        GroupAnnouncement entity = requireInGroup(announcementId, groupId);
        entity.setTitle(dto.getTitle().trim());
        entity.setBody(dto.getBody());
        entity.setPinned(dto.isPinned());
        entity.setUpdatedAt(LocalDateTime.now());
        return toDto(groupAnnouncementRepository.save(entity));
    }

    public void archive(Long groupId, Long announcementId, Long enterpriseId, Long userId, boolean owner) {
        enterpriseGroupService.getAccessibleById(groupId, enterpriseId, userId, owner);
        GroupAnnouncement entity = requireInGroup(announcementId, groupId);
        entity.setStatus(GroupAnnouncement.Status.archived);
        entity.setUpdatedAt(LocalDateTime.now());
        groupAnnouncementRepository.save(entity);
    }

    // The announcement must belong to the same group the access check passed for,
    // so an id from another group can't be edited through this group's path.
    private GroupAnnouncement requireInGroup(Long announcementId, Long groupId) {
        GroupAnnouncement entity = groupAnnouncementRepository.findById(announcementId)
                .orElseThrow(() -> new EntityNotFoundException("Announcement not found: " + announcementId));
        if (entity.getEnterpriseGroup() == null
                || !entity.getEnterpriseGroup().getEnterpriseGroupId().equals(groupId)) {
            throw new EntityNotFoundException("Announcement not found: " + announcementId);
        }
        return entity;
    }

    private GroupAnnouncementDto toDto(GroupAnnouncement entity) {
        return new GroupAnnouncementDto(
                entity.getGroupAnnouncementId(),
                entity.getEnterpriseGroup() != null ? entity.getEnterpriseGroup().getEnterpriseGroupId() : null,
                entity.getTitle(),
                entity.getBody(),
                entity.isPinned(),
                entity.getCreatedBy() != null ? entity.getCreatedBy().getUserId() : null,
                entity.getCreatedBy() != null ? entity.getCreatedBy().getEmail() : null,
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getStatus().name());
    }
}

package com.capstone.rebyu.enterprisegroup.repository;

import com.capstone.rebyu.enterprisegroup.entity.GroupAnnouncement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GroupAnnouncementRepository extends JpaRepository<GroupAnnouncement, Long> {

    // Pinned first, then newest -- the reading order the workspace shows.
    List<GroupAnnouncement> findByEnterpriseGroup_EnterpriseGroupIdAndStatusOrderByPinnedDescCreatedAtDesc(
            Long enterpriseGroupId, GroupAnnouncement.Status status);
}

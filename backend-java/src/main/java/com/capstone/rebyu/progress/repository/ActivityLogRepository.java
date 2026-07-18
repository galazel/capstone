package com.capstone.rebyu.progress.repository;

import com.capstone.rebyu.progress.entity.ActivityLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {

    List<ActivityLog> findByUser_UserId(Long userId);
}

package com.capstone.rebyu.dashboard.repository;

import com.capstone.rebyu.dashboard.entity.UserDashboardLayout;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserDashboardLayoutRepository extends JpaRepository<UserDashboardLayout, Long> {

    Optional<UserDashboardLayout> findByUser_UserIdAndBoard(Long userId, String board);
}

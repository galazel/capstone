package com.capstone.rebyu.gamification.repository;

import com.capstone.rebyu.gamification.entity.GamificationSettings;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GamificationSettingsRepository extends JpaRepository<GamificationSettings, Short> {
}

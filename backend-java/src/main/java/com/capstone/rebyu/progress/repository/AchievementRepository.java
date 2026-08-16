package com.capstone.rebyu.progress.repository;

import com.capstone.rebyu.progress.entity.Achievement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AchievementRepository extends JpaRepository<Achievement, Long> {

    /**
     * Title is the natural key for the catalog (it is UNIQUE on the table);
     * generated ids differ per environment, so seeding and awarding both match
     * on this instead. See {@code AchievementCatalog}.
     */
    Optional<Achievement> findByTitleIgnoreCase(String title);
}

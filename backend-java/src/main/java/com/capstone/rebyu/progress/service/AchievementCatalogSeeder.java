package com.capstone.rebyu.progress.service;

import com.capstone.rebyu.progress.entity.Achievement;
import com.capstone.rebyu.progress.repository.AchievementRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Makes sure every {@link AchievementCatalog} entry exists as a row before the
 * award service tries to hand one out.
 *
 * <p>The catalog is application data, not learner data, so it is owned by the
 * code rather than by whoever happened to type rows into the database console.
 * Matching on the unique title means an environment that already has the rows
 * (ids 25-32 in the development database) is left exactly as it is -- only
 * missing entries are inserted, and existing descriptions are refreshed so the
 * copy the learner reads always matches the copy in the enum.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@Order(0)
public class AchievementCatalogSeeder implements ApplicationRunner {

    private final AchievementRepository achievementRepository;

    @Override
    public void run(ApplicationArguments args) {
        int created = 0;
        int updated = 0;
        for (AchievementCatalog entry : AchievementCatalog.values()) {
            // Per entry, in its own transaction: an ApplicationRunner that
            // throws takes the whole application down with it, and a catalog
            // row that will not insert (a legacy column left NOT NULL by an
            // older schema, say) must not be the reason REBYU refuses to start.
            try {
                switch (sync(entry)) {
                    case CREATED -> created++;
                    case UPDATED -> updated++;
                    case UNCHANGED -> { }
                }
            } catch (RuntimeException e) {
                log.warn("Could not sync achievement '{}': {}", entry.title(), e.getMessage());
            }
        }
        if (created > 0 || updated > 0) {
            log.info("Achievement catalog synced: {} created, {} description(s) updated", created, updated);
        }
    }

    private enum Result { CREATED, UPDATED, UNCHANGED }

    /**
     * No {@code @Transactional} here on purpose: it would be a self-invocation
     * from {@link #run}, so the proxy is bypassed and the annotation would
     * enforce nothing. Each repository call carries its own transaction, which
     * is exactly the per-entry isolation this needs.
     */
    private Result sync(AchievementCatalog entry) {
        Achievement existing = achievementRepository.findByTitleIgnoreCase(entry.title()).orElse(null);
        if (existing == null) {
            achievementRepository.save(Achievement.builder()
                    .title(entry.title())
                    .description(entry.description())
                    .build());
            return Result.CREATED;
        }
        if (!entry.description().equals(existing.getDescription())) {
            existing.setDescription(entry.description());
            achievementRepository.save(existing);
            return Result.UPDATED;
        }
        return Result.UNCHANGED;
    }
}

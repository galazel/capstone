package com.capstone.rebyu.dashboard.service;

import com.capstone.rebyu.dashboard.entity.UserDashboardLayout;
import com.capstone.rebyu.dashboard.repository.UserDashboardLayoutRepository;
import com.capstone.rebyu.user.entity.User;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;

/**
 * Read and write one person's arrangement of one dashboard.
 *
 * The same tile-placement shape the learner analytics board already persists, so
 * the frontend board component works unchanged across all three dashboards; only
 * the storage differs, because admins and enterprise managers have no learner row
 * for the learner-keyed table to hang off.
 */
@Service
@RequiredArgsConstructor
public class DashboardLayoutService {

    /**
     * Boards that may be stored. An allow-list rather than a free string: `board`
     * lands in a UNIQUE key, and letting the client name it means one typo (or one
     * loop) fills the table with rows nothing will ever read again.
     */
    private static final Set<String> KNOWN_BOARDS = Set.of("admin", "enterprise");

    private final UserDashboardLayoutRepository layoutRepository;
    private final EntityManager entityManager;
    private final ObjectMapper mapper = new ObjectMapper();

    public record TilePlacement(String id, Integer x, Integer y, Integer w, Integer h) {}

    @Transactional(readOnly = true)
    public List<TilePlacement> layout(Long userId, String board) {
        return layoutRepository.findByUser_UserIdAndBoard(userId, requireKnownBoard(board))
                .map(row -> read(row.getTileOrder()))
                .orElseGet(List::of);
    }

    @Transactional
    public List<TilePlacement> saveLayout(Long userId, String board, List<TilePlacement> tiles) {
        String key = requireKnownBoard(board);

        List<TilePlacement> layout = tiles == null ? List.of() : tiles.stream()
                .filter(tile -> tile != null && tile.id() != null && !tile.id().isBlank())
                .map(tile -> new TilePlacement(
                        tile.id(),
                        tile.x() == null ? 0 : Math.max(0, tile.x()),
                        tile.y() == null ? 0 : Math.max(0, tile.y()),
                        tile.w() == null ? 1 : Math.max(1, tile.w()),
                        tile.h() == null ? 1 : Math.max(1, tile.h())))
                .toList();

        // find-then-save, not an upsert. The UNIQUE(user_id, board) exists in the
        // migration and on the entity, but an ON CONFLICT would still be the wrong
        // shape here: environments whose schema came from ddl-auto have historically
        // been missing migration-only constraints, and ON CONFLICT against a missing
        // constraint is a 42P10 that rolls back the caller rather than a no-op.
        UserDashboardLayout row = layoutRepository.findByUser_UserIdAndBoard(userId, key)
                .orElseGet(() -> UserDashboardLayout.builder()
                        .user(entityManager.getReference(User.class, userId))
                        .board(key)
                        .build());
        row.setTileOrder(write(layout));
        row.setUpdatedAt(OffsetDateTime.now());
        layoutRepository.save(row);
        return layout;
    }

    private String requireKnownBoard(String board) {
        String key = board == null ? "" : board.trim().toLowerCase();
        if (!KNOWN_BOARDS.contains(key)) {
            throw new IllegalArgumentException("Unknown dashboard board: " + board);
        }
        return key;
    }

    /**
     * A stored arrangement that no longer parses is treated as "no arrangement".
     * Failing the whole dashboard because a preference blob went bad would take
     * the page down over something cosmetic.
     */
    private List<TilePlacement> read(String json) {
        try {
            return mapper.readValue(json, new TypeReference<List<TilePlacement>>() {});
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private String write(List<TilePlacement> layout) {
        try {
            return mapper.writeValueAsString(layout);
        } catch (Exception e) {
            throw new IllegalStateException("Could not serialize the dashboard layout", e);
        }
    }
}

package com.capstone.rebyu.user.service;

import com.capstone.rebyu.auth.service.CognitoAdminService;
import com.capstone.rebyu.certification.service.S3StorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Erases a learner and everything that belongs to them.
 *
 * <p>Why this walks the catalog instead of listing tables: 28 entities point at
 * {@code learners} today and more hang off those, and the list grows with every
 * feature. A hand-written list is a list someone forgets to update, and the
 * failure mode is a foreign-key error in front of an admin mid-delete. Asking
 * Postgres which tables reference which is always current.
 *
 * <p>It also cannot lean on ON DELETE CASCADE: this schema is built by Hibernate
 * {@code ddl-auto: update}, whose generated foreign keys carry no ON DELETE rule
 * (see SchemaDefaultsSeeder and V59), so the database will refuse the delete
 * rather than cascade it.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LearnerDeletionService {

    /** Depth of the child-table walk. The real graph is ~3 deep; this is a runaway guard. */
    private static final int MAX_DEPTH = 8;

    private final JdbcTemplate jdbc;
    private final S3StorageService s3StorageService;
    private final CognitoAdminService cognitoAdminService;

    /**
     * Deletes the learner's rows, their uploaded files, their user account, and
     * their Cognito sign-in.
     *
     * <p>The Cognito account is the part that makes this stick. Deleting only the
     * rows is undone by the next sign-in: CognitoAuthService#linkOrProvision
     * re-provisions a User and Learner for any valid token whose subject it does
     * not recognise, so the person would simply reappear with an empty profile.
     */
    @Transactional
    public void deleteLearner(Long learnerId) {
        List<String> fileKeys = attachmentKeysOf(learnerId);
        String cognitoSub = jdbc.query(
                "SELECT u.cognito_sub FROM learners l JOIN users u ON u.user_id = l.user_id WHERE l.learner_id = ?",
                rs -> rs.next() ? rs.getString(1) : null, learnerId);
        Long userId = jdbc.query("SELECT user_id FROM learners WHERE learner_id = ?",
                rs -> rs.next() ? rs.getObject(1, Long.class) : null, learnerId);

        deleteDescendants("learners", "SELECT learner_id FROM learners WHERE learner_id = " + learnerId, 0);
        jdbc.update("DELETE FROM learners WHERE learner_id = ?", learnerId);

        if (userId != null) {
            // The user row is the learner's account, not shared with anyone else.
            deleteDescendants("users", "SELECT user_id FROM users WHERE user_id = " + userId, 0);
            jdbc.update("DELETE FROM users WHERE user_id = ?", userId);
        }

        // Outside the database, so failures are logged rather than rolled back:
        // a stale S3 object or Cognito account must not resurrect deleted rows.
        for (String key : fileKeys) {
            try {
                s3StorageService.deleteFile(key);
            } catch (Exception ex) {
                log.warn("Learner {} deleted, but stored file {} could not be removed: {}",
                        learnerId, key, ex.getMessage());
            }
        }
        if (cognitoSub != null && !cognitoSub.isBlank()) {
            cognitoAdminService.deleteAccount(cognitoSub);
        }
        log.info("Deleted learner {} ({} stored files, cognito sub {})",
                learnerId, fileKeys.size(), cognitoSub == null ? "none" : "removed");
    }

    /**
     * S3 keys this learner uploaded, read before the rows that name them are gone:
     * community post attachments, plus library items of type "file", which store a
     * raw S3 key in resource_url (generated study aids store a "/learner/..." route
     * there instead, which is why the leading slash is excluded).
     */
    private List<String> attachmentKeysOf(Long learnerId) {
        List<String> keys = new ArrayList<>(jdbc.queryForList(
                "SELECT attachment_key FROM community_posts "
                        + "WHERE author_learner_id = ? AND attachment_key IS NOT NULL",
                String.class, learnerId));
        keys.addAll(jdbc.queryForList(
                "SELECT resource_url FROM learner_library_items "
                        + "WHERE learner_id = ? AND item_type = 'file' "
                        + "AND resource_url IS NOT NULL AND resource_url NOT LIKE '/%'",
                String.class, learnerId));
        return keys;
    }

    /**
     * Deletes everything that hangs off the rows {@code parentKeysSql} selects,
     * deepest first, leaving the rows themselves for the caller.
     */
    private void deleteDescendants(String parentTable, String parentKeysSql, int depth) {
        if (depth >= MAX_DEPTH) {
            log.warn("Stopped cascading below {} at depth {}", parentTable, depth);
            return;
        }
        for (Map<String, Object> fk : childForeignKeys(parentTable)) {
            String childTable = (String) fk.get("child_table");
            String childColumn = (String) fk.get("child_column");
            String parentColumn = (String) fk.get("parent_column");

            // A self-reference (a comment's parent comment) needs no recursion: one
            // DELETE removes parent and child rows together, and Postgres checks the
            // key at end of statement.
            if (!childTable.equals(parentTable)) {
                String childKeys = singleColumnPrimaryKey(childTable)
                        .map(pk -> "SELECT \"" + pk + "\" FROM \"" + childTable + "\" WHERE \"" + childColumn
                                + "\" IN (SELECT \"" + parentColumn + "\" FROM (" + parentKeysSql + ") AS parent_keys)")
                        .orElse(null);
                // No single-column key means a join table -- nothing hangs off it.
                if (childKeys != null) {
                    deleteDescendants(childTable, childKeys, depth + 1);
                }
            }

            int removed = jdbc.update("DELETE FROM \"" + childTable + "\" WHERE \"" + childColumn
                    + "\" IN (SELECT \"" + parentColumn + "\" FROM (" + parentKeysSql + ") AS parent_keys)");
            if (removed > 0) {
                log.debug("Removed {} row(s) from {}", removed, childTable);
            }
        }
    }

    /** Every foreign key pointing at {@code parentTable}, from the live catalog. */
    private List<Map<String, Object>> childForeignKeys(String parentTable) {
        return jdbc.queryForList("""
                SELECT c.conrelid::regclass::text AS child_table,
                       child_att.attname          AS child_column,
                       parent_att.attname         AS parent_column
                FROM pg_constraint c
                JOIN pg_attribute child_att
                  ON child_att.attrelid = c.conrelid AND child_att.attnum = c.conkey[1]
                JOIN pg_attribute parent_att
                  ON parent_att.attrelid = c.confrelid AND parent_att.attnum = c.confkey[1]
                WHERE c.contype = 'f'
                  AND c.confrelid = ?::regclass
                  AND array_length(c.conkey, 1) = 1
                """, parentTable);
    }

    private Optional<String> singleColumnPrimaryKey(String table) {
        List<String> columns = jdbc.queryForList("""
                SELECT att.attname
                FROM pg_constraint c
                JOIN pg_attribute att ON att.attrelid = c.conrelid AND att.attnum = ANY(c.conkey)
                WHERE c.contype = 'p' AND c.conrelid = ?::regclass
                """, String.class, table);
        return columns.size() == 1 ? Optional.of(columns.get(0)) : Optional.empty();
    }
}

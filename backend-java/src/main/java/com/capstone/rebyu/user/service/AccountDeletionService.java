package com.capstone.rebyu.user.service;

import com.capstone.rebyu.bkt.client.BktClient;
import com.capstone.rebyu.certification.service.S3StorageService;
import com.capstone.rebyu.common.BusinessRuleException;
import com.capstone.rebyu.enterprisegroup.repository.EnterpriseGroupRepository;
import com.capstone.rebyu.learningtools.entity.LearnerLibraryItem;
import com.capstone.rebyu.learningtools.repository.LearnerLibraryItemRepository;
import com.capstone.rebyu.user.entity.Learner;
import com.capstone.rebyu.user.entity.User;
import com.capstone.rebyu.user.repository.LearnerRepository;
import com.capstone.rebyu.user.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deletes a learner or user together with every row that belongs to them,
 * across both this database and the BKT service's database. There is no
 * partial state on failure: the BKT purge runs first (outside any Postgres
 * write), so if it fails nothing here has been touched yet, and every
 * Postgres delete below runs in the same transaction as the final row
 * removal, so a failure anywhere rolls the whole thing back.
 *
 * Deletion order mirrors {@code CertificationService.deleteRelatedCertificationData}
 * (children before parents); tables with an existing {@code ON DELETE CASCADE}
 * (community_*, learner_library_items, learner_mistake_reviews) are left for
 * Postgres to clean up via the final learner/user delete rather than
 * re-deleted here.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class AccountDeletionService {

    private final LearnerRepository learnerRepository;
    private final UserRepository userRepository;
    private final EnterpriseGroupRepository enterpriseGroupRepository;
    private final LearnerLibraryItemRepository learnerLibraryItemRepository;
    private final EntityManager entityManager;
    private final BktClient bktClient;
    private final S3StorageService s3StorageService;

    public void deleteLearner(Long learnerId) {
        Learner learner = findLearner(learnerId);

        // Fail-closed: if the BKT service can't confirm the purge, nothing
        // else runs and this method throws before any Postgres write happens.
        bktClient.purgeLearner(learnerId);

        deleteLearnerOwnedFiles(learnerId);
        deleteRelatedLearnerData(learnerId);

        // Triggers ON DELETE CASCADE for community_*, learner_library_items,
        // and learner_mistake_reviews.
        learnerRepository.delete(learner);

        log.info("Deleted learner {} and all related data", learnerId);
    }

    public void deleteUser(Long userId) {
        User user = findUser(userId);

        if (enterpriseGroupRepository.existsByCreatedBy_UserId(userId)) {
            throw new BusinessRuleException.EnterpriseGroupRuleException(
                    "This account still owns an enterprise group. Reassign or archive it before deleting the account.");
        }

        learnerRepository.findByUser_UserId(userId)
                .ifPresent(learner -> deleteLearner(learner.getLearnerId()));

        deleteRelatedUserData(userId);
        userRepository.delete(user);

        log.info("Deleted user {} and all related data", userId);
    }

    /**
     * Fetches the S3 key for every "file"-type library item before the row
     * itself is removed by cascade, and deletes the object from the bucket.
     * "link"-type items store a pasted external URL, not an S3 key, and are
     * left alone.
     */
    private void deleteLearnerOwnedFiles(Long learnerId) {
        for (LearnerLibraryItem item : learnerLibraryItemRepository
                .findByLearner_LearnerIdOrderByCreatedAtDesc(learnerId)) {
            if ("file".equals(item.getItemType()) && item.getResourceUrl() != null) {
                s3StorageService.deleteFile(item.getResourceUrl());
            }
        }
    }

    private void deleteRelatedLearnerData(Long learnerId) {
        // Assessment attempt tree: executions/answers/questions reference the
        // attempt, so they must go before assessment_attempts itself, which
        // has no DB-level FK to learners at all (plain column).
        executeDelete("""
                DELETE FROM assessment_attempt_executions
                WHERE assessment_attempt_id IN (
                    SELECT assessment_attempt_id FROM assessment_attempts WHERE learner_id = :learnerId
                )
                """, learnerId);
        executeDelete("""
                DELETE FROM assessment_attempt_answers
                WHERE assessment_attempt_id IN (
                    SELECT assessment_attempt_id FROM assessment_attempts WHERE learner_id = :learnerId
                )
                """, learnerId);
        executeDelete("""
                DELETE FROM assessment_attempt_questions
                WHERE assessment_attempt_id IN (
                    SELECT assessment_attempt_id FROM assessment_attempts WHERE learner_id = :learnerId
                )
                """, learnerId);
        executeDelete("DELETE FROM assessment_attempts WHERE learner_id = :learnerId", learnerId);

        // Legacy per-question-type answers reference learner_exam_details,
        // which must go before that parent row.
        executeDelete("""
                DELETE FROM learner_mcq_answers
                WHERE learner_exam_detail_id IN (
                    SELECT learner_exam_detail_id FROM learner_exam_details WHERE learner_id = :learnerId
                )
                """, learnerId);
        executeDelete("""
                DELETE FROM learner_text_answers
                WHERE learner_exam_detail_id IN (
                    SELECT learner_exam_detail_id FROM learner_exam_details WHERE learner_id = :learnerId
                )
                """, learnerId);
        executeDelete("""
                DELETE FROM learner_programming_answers
                WHERE learner_exam_detail_id IN (
                    SELECT learner_exam_detail_id FROM learner_exam_details WHERE learner_id = :learnerId
                )
                """, learnerId);
        executeDelete("""
                DELETE FROM learner_diagram_answers
                WHERE learner_exam_detail_id IN (
                    SELECT learner_exam_detail_id FROM learner_exam_details WHERE learner_id = :learnerId
                )
                """, learnerId);
        executeDelete("DELETE FROM learner_exam_details WHERE learner_id = :learnerId", learnerId);

        // Independent leaf tables keyed directly by learner_id, no children.
        executeDelete("DELETE FROM exam_results WHERE learner_id = :learnerId", learnerId);
        executeDelete("DELETE FROM challenge_sessions WHERE learner_id = :learnerId", learnerId);
        executeDelete("DELETE FROM learner_completed_lessons WHERE learner_id = :learnerId", learnerId);
        executeDelete("DELETE FROM learner_achievements WHERE learner_id = :learnerId", learnerId);

        // No FK constraint at all, but still owns real mastery payloads.
        executeDelete("DELETE FROM bkt_event_outbox WHERE learner_id = :learnerId", learnerId);

        // Nullable, RESTRICT-constrained.
        executeDelete("DELETE FROM learner_invitations WHERE learner_id = :learnerId", learnerId);

        // RESTRICT-constrained.
        executeDelete("DELETE FROM learner_subscriptions WHERE learner_id = :learnerId", learnerId);

        // enterprise_group_assignees blocks organization_certification_learners.
        executeDelete("""
                DELETE FROM enterprise_group_assignees
                WHERE org_cert_learner_id IN (
                    SELECT org_cert_learner_id FROM organization_certification_learners WHERE learner_id = :learnerId
                )
                """, learnerId);
        executeDelete(
                "DELETE FROM organization_certification_learners WHERE learner_id = :learnerId", learnerId);

        // Diamond: learner_certifications holds the FK *to* learner_order_details
        // (not the reverse), so it must be deleted before learner_order_details,
        // which must be deleted before learner_orders.
        executeDelete("DELETE FROM learner_certifications WHERE learner_id = :learnerId", learnerId);
        executeDelete("""
                DELETE FROM learner_order_details
                WHERE order_id IN (
                    SELECT order_id FROM learner_orders WHERE learner_id = :learnerId
                )
                """, learnerId);
        executeDelete("DELETE FROM learner_orders WHERE learner_id = :learnerId", learnerId);
    }

    private void deleteRelatedUserData(Long userId) {
        executeDeleteForUser("""
                DELETE FROM enterprise_group_authorities
                WHERE user_id = :userId OR assigned_by = :userId
                """, userId);
        executeDeleteForUser("DELETE FROM enterprise_group_assignees WHERE assigned_by = :userId", userId);
        executeDeleteForUser("DELETE FROM enterprise_members WHERE user_id = :userId", userId);
        executeDeleteForUser("DELETE FROM activity_logs WHERE user_id = :userId", userId);
    }

    private void executeDelete(String sql, Long learnerId) {
        entityManager.createNativeQuery(sql).setParameter("learnerId", learnerId).executeUpdate();
    }

    private void executeDeleteForUser(String sql, Long userId) {
        entityManager.createNativeQuery(sql).setParameter("userId", userId).executeUpdate();
    }

    private Learner findLearner(Long id) {
        return learnerRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Learner not found: " + id));
    }

    private User findUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + id));
    }
}

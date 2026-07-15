package com.capstone.rebyu.user.service;

import com.capstone.rebyu.bkt.client.BktClient;
import com.capstone.rebyu.bkt.client.BktServiceException;
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
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentCaptor.forClass;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AccountDeletionServiceTest {

    private static final Long LEARNER_ID = 100L;
    private static final Long USER_ID = 7L;

    private LearnerRepository learnerRepository;
    private UserRepository userRepository;
    private EnterpriseGroupRepository enterpriseGroupRepository;
    private LearnerLibraryItemRepository learnerLibraryItemRepository;
    private EntityManager entityManager;
    private BktClient bktClient;
    private S3StorageService s3StorageService;
    private Query nativeQuery;

    private AccountDeletionService service;

    @BeforeEach
    void setUp() {
        learnerRepository = mock(LearnerRepository.class);
        userRepository = mock(UserRepository.class);
        enterpriseGroupRepository = mock(EnterpriseGroupRepository.class);
        learnerLibraryItemRepository = mock(LearnerLibraryItemRepository.class);
        entityManager = mock(EntityManager.class);
        bktClient = mock(BktClient.class);
        s3StorageService = mock(S3StorageService.class);

        nativeQuery = mock(Query.class);
        when(entityManager.createNativeQuery(anyString())).thenReturn(nativeQuery);
        when(nativeQuery.setParameter(anyString(), any())).thenReturn(nativeQuery);
        when(nativeQuery.executeUpdate()).thenReturn(0);

        service = new AccountDeletionService(
                learnerRepository,
                userRepository,
                enterpriseGroupRepository,
                learnerLibraryItemRepository,
                entityManager,
                bktClient,
                s3StorageService);

        Learner learner = new Learner();
        learner.setLearnerId(LEARNER_ID);
        when(learnerRepository.findById(LEARNER_ID)).thenReturn(Optional.of(learner));
        when(learnerLibraryItemRepository.findByLearner_LearnerIdOrderByCreatedAtDesc(LEARNER_ID))
                .thenReturn(List.of());

        User user = new User();
        user.setUserId(USER_ID);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        when(enterpriseGroupRepository.existsByCreatedBy_UserId(USER_ID)).thenReturn(false);
        when(learnerRepository.findByUser_UserId(USER_ID)).thenReturn(Optional.empty());
    }

    private LearnerLibraryItem libraryItem(String itemType, String resourceUrl) {
        return LearnerLibraryItem.builder()
                .libraryItemId(1L)
                .itemType(itemType)
                .resourceUrl(resourceUrl)
                .title("t")
                .build();
    }

    // ---- 1: BKT purge happens before any Postgres write ----
    @Test
    void deleteLearner_bktPurgeFailure_abortsBeforeAnyNativeQuery() {
        doThrow(new BktServiceException("down", new RuntimeException())).when(bktClient).purgeLearner(LEARNER_ID);

        assertThrows(BktServiceException.class, () -> service.deleteLearner(LEARNER_ID));

        verify(entityManager, never()).createNativeQuery(anyString());
        verify(learnerRepository, never()).delete(any());
    }

    // ---- 2: happy path deletes everything and removes the learner last ----
    @Test
    void deleteLearner_happyPath_purgesThenDeletesThenRemovesLearnerRow() {
        service.deleteLearner(LEARNER_ID);

        verify(bktClient).purgeLearner(LEARNER_ID);
        verify(entityManager, org.mockito.Mockito.atLeast(15)).createNativeQuery(anyString());
        verify(learnerRepository).delete(any(Learner.class));
    }

    // ---- 3: S3 cleanup only for "file" items with a resource URL ----
    @Test
    void deleteLearner_onlyDeletesS3ForFileTypeItemsWithResourceUrl() {
        when(learnerLibraryItemRepository.findByLearner_LearnerIdOrderByCreatedAtDesc(LEARNER_ID))
                .thenReturn(List.of(
                        libraryItem("file", "library/abc.pdf"),
                        libraryItem("link", "https://example.com/resource"),
                        libraryItem("file", null)
                ));

        service.deleteLearner(LEARNER_ID);

        verify(s3StorageService, times(1)).deleteFile("library/abc.pdf");
        verify(s3StorageService, never()).deleteFile("https://example.com/resource");
    }

    // ---- 4: dependency ordering for the trickiest chains ----
    @Test
    void deleteLearner_ordersAssessmentTreeAndCertificationDiamondCorrectly() {
        var sqlCaptor = forClass(String.class);

        service.deleteLearner(LEARNER_ID);

        verify(entityManager, org.mockito.Mockito.atLeastOnce()).createNativeQuery(sqlCaptor.capture());
        List<String> statements = sqlCaptor.getAllValues();

        int executions = indexOfContaining(statements, "assessment_attempt_executions");
        int answers = indexOfContaining(statements, "assessment_attempt_answers");
        int questions = indexOfContaining(statements, "assessment_attempt_questions");
        int attemptsLeaf = indexOfExact(statements, "assessment_attempts");
        assertTrue(executions < attemptsLeaf, "executions must be deleted before the attempts leaf row");
        assertTrue(answers < attemptsLeaf, "answers must be deleted before the attempts leaf row");
        assertTrue(questions < attemptsLeaf, "questions must be deleted before the attempts leaf row");

        int certifications = indexOfContaining(statements, "learner_certifications");
        int orderDetails = indexOfContaining(statements, "learner_order_details");
        int orders = indexOfExact(statements, "learner_orders");
        assertTrue(certifications < orderDetails,
                "learner_certifications holds the FK to learner_order_details and must go first");
        assertTrue(orderDetails < orders, "learner_order_details must be deleted before learner_orders");
    }

    private int indexOfContaining(List<String> statements, String needle) {
        for (int i = 0; i < statements.size(); i++) {
            if (statements.get(i).contains(needle)) {
                return i;
            }
        }
        throw new AssertionError("No statement referencing " + needle);
    }

    /**
     * Matches only the bare leaf "DELETE FROM x WHERE learner_id = :learnerId"
     * statement itself -- not a subquery that merely references the same
     * table name inside a "FROM x WHERE" clause (several sibling statements
     * filter their subqueries by "FROM assessment_attempts WHERE learner_id",
     * which a loose contains() check would wrongly match first).
     */
    private int indexOfExact(List<String> statements, String table) {
        String leaf = "DELETE FROM " + table + " WHERE learner_id = :learnerId";
        for (int i = 0; i < statements.size(); i++) {
            if (statements.get(i).trim().equals(leaf)) {
                return i;
            }
        }
        throw new AssertionError("No leaf statement for table " + table);
    }

    // ---- 5: enterprise group ownership blocks the whole deletion ----
    @Test
    void deleteUser_ownsActiveEnterpriseGroup_throwsAndDeletesNothing() {
        when(enterpriseGroupRepository.existsByCreatedBy_UserId(USER_ID)).thenReturn(true);

        assertThrows(BusinessRuleException.EnterpriseGroupRuleException.class,
                () -> service.deleteUser(USER_ID));

        verify(entityManager, never()).createNativeQuery(anyString());
        verify(userRepository, never()).delete(any());
        verify(bktClient, never()).purgeLearner(anyLong());
    }

    // ---- 6: deleting a user with a linked learner cascades both sides ----
    @Test
    void deleteUser_withLinkedLearner_cascadesLearnerThenDeletesUser() {
        Learner learner = new Learner();
        learner.setLearnerId(LEARNER_ID);
        when(learnerRepository.findByUser_UserId(USER_ID)).thenReturn(Optional.of(learner));

        service.deleteUser(USER_ID);

        verify(bktClient).purgeLearner(LEARNER_ID);
        verify(learnerRepository).delete(learner);
        verify(userRepository).delete(any(User.class));
    }

    // ---- 7: deleting a user with no linked learner only runs the user-side steps ----
    @Test
    void deleteUser_withNoLinkedLearner_skipsLearnerCascade() {
        service.deleteUser(USER_ID);

        verify(bktClient, never()).purgeLearner(anyLong());
        verify(learnerRepository, never()).delete(any());
        verify(userRepository).delete(any(User.class));
    }

    // ---- 8: not-found ----
    @Test
    void deleteLearner_unknownId_throwsEntityNotFoundException() {
        when(learnerRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> service.deleteLearner(999L));
    }

    @Test
    void deleteUser_unknownId_throwsEntityNotFoundException() {
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> service.deleteUser(999L));
    }
}

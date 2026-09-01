package com.capstone.rebyu.certification.service;

import com.capstone.rebyu.common.BusinessRuleException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The two things about this purge that are not obvious from reading it: what it
 * counts as in scope, and what order it deletes in.
 *
 * Both were wrong in the shape this replaced. Deleting a module through the
 * whole-tree PUT scoped nothing at all and simply hit a foreign key; scoping the
 * obvious way -- by the lessons underneath -- still leaves the module's own
 * category assessment pointing at it, and fails the same way one step later.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CurriculumSubtreeServiceTest {

    @Mock private EntityManager entityManager;
    @Mock private Query query;

    private CurriculumSubtreeService service;

    /** Every statement the service issued, in the order it issued them. */
    private final List<String> statements = new ArrayList<>();

    @BeforeEach
    void setUp() {
        statements.clear();

        when(entityManager.createNativeQuery(anyString())).thenAnswer(invocation -> {
            statements.add(invocation.getArgument(0));
            return query;
        });
        when(query.setParameter(anyString(), any())).thenReturn(query);
        when(query.executeUpdate()).thenReturn(0);
        // No learner activity unless a test says otherwise.
        when(query.getSingleResult()).thenReturn(0L);

        service = new CurriculumSubtreeService(entityManager);
    }

    private String firstMatching(String fragment) {
        return statements.stream()
                .filter(sql -> sql.contains(fragment))
                .findFirst()
                .orElseThrow(() -> new AssertionError("No statement contained: " + fragment));
    }

    private int indexOf(String fragment) {
        for (int i = 0; i < statements.size(); i++) {
            if (statements.get(i).contains(fragment)) {
                return i;
            }
        }
        throw new AssertionError("No statement contained: " + fragment);
    }

    @Test
    void aModuleTakesItsOwnAssessmentAndItsLessonsQuizzes() {
        service.clearFor(CurriculumSubtreeService.Node.MIDDLE, 7L);

        String exams = firstMatching("DELETE FROM exams");

        assertTrue(exams.contains("middle_category_id = :nodeId"),
                "the module's own category assessment must be in scope: " + exams);
        assertTrue(exams.contains("lesson_id IN (SELECT lesson_id FROM lessons WHERE middle_category_id = :nodeId)"),
                "every lesson quiz beneath it must be in scope too: " + exams);
    }

    @Test
    void aMajorReachesThroughItsModulesToTheLessons() {
        service.clearFor(CurriculumSubtreeService.Node.MAJOR, 3L);

        String exams = firstMatching("DELETE FROM exams");

        assertTrue(exams.contains("major_category_id = :nodeId"), exams);
        assertTrue(exams.contains("middle_categories WHERE major_category_id = :nodeId"), exams);
    }

    @Test
    void aLessonScopesToItself() {
        service.clearFor(CurriculumSubtreeService.Node.LESSON, 11L);

        assertEquals(
                "DELETE FROM exams WHERE exam_id IN (SELECT exam_id FROM exams WHERE lesson_id = :nodeId)",
                firstMatching("DELETE FROM exams"));
    }

    /**
     * The order is the whole point of doing this in SQL rather than leaving it
     * to JPA: each of these pairs is a foreign key, and getting one backwards
     * is the constraint violation that made deleting impossible before.
     */
    @Test
    void deletesChildrenBeforeTheRowsTheyPointAt() {
        service.clearFor(CurriculumSubtreeService.Node.LESSON, 11L);

        assertTrue(indexOf("DELETE FROM exam_choices") < indexOf("DELETE FROM exam_questions"));
        assertTrue(indexOf("DELETE FROM exam_questions") < indexOf("DELETE FROM exams"));
        assertTrue(indexOf("DELETE FROM programming_test_cases")
                < indexOf("DELETE FROM programming_question_configs"));
        assertTrue(indexOf("DELETE FROM choices") < indexOf("DELETE FROM questions WHERE question_id"));
        assertTrue(indexOf("DELETE FROM questions WHERE parent_question_id")
                < indexOf("DELETE FROM questions WHERE question_id"),
                "a follow-up question has to go before the question it hangs off");
        // exam_questions references questions as well as exams, so the whole
        // exam side has to be gone before any question is touched.
        assertTrue(indexOf("DELETE FROM exams") < indexOf("DELETE FROM choices"));
    }

    @Test
    void refusesRatherThanErasingGradedRecords() {
        when(query.getSingleResult()).thenReturn(3L);

        BusinessRuleException.CurriculumNodeInUseException error = assertThrows(
                BusinessRuleException.CurriculumNodeInUseException.class,
                () -> service.clearFor(CurriculumSubtreeService.Node.MIDDLE, 7L));

        assertTrue(error.getMessage().contains("module"), error.getMessage());
        assertTrue(error.getMessage().contains("3 assessment attempts"), error.getMessage());
    }

    @Test
    void refusingDeletesNothingAtAll() {
        when(query.getSingleResult()).thenReturn(1L);

        assertThrows(
                BusinessRuleException.CurriculumNodeInUseException.class,
                () -> service.clearFor(CurriculumSubtreeService.Node.LESSON, 11L));

        // The check runs before the first delete, so a refusal cannot leave a
        // node half-stripped -- which would be worse than not deleting it.
        assertTrue(statements.stream().noneMatch(sql -> sql.startsWith("DELETE")),
                "nothing may be deleted once the node is known to be in use");
        verify(entityManager, never()).flush();
    }

    @Test
    void singularWhenThereIsOnlyOneRecordInTheWay() {
        when(query.getSingleResult()).thenReturn(1L);

        BusinessRuleException.CurriculumNodeInUseException error = assertThrows(
                BusinessRuleException.CurriculumNodeInUseException.class,
                () -> service.clearFor(CurriculumSubtreeService.Node.LESSON, 11L));

        assertTrue(error.getMessage().contains("1 assessment attempt from learners"),
                error.getMessage());
    }
}

package com.capstone.rebyu.certification.service;

import com.capstone.rebyu.common.BusinessRuleException;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Clears everything hanging off a curriculum node so the node itself can go.
 *
 * Deleting a major category, a module, or a lesson used to be impossible in
 * practice. The only editor was the certification drawer, which rebuilt the
 * whole tree through {@code PUT /certifications/{id}} and left JPA's
 * {@code orphanRemoval} to drop whatever was missing -- but every foreign key
 * into {@code lessons}, {@code middle_categories} and {@code major_categories}
 * is NO ACTION, and a generated lesson always has an exam and a stack of
 * questions pointing at it. The delete died on a constraint violation before it
 * removed anything.
 *
 * <p>So a node's own content is removed here first, in dependency order, and
 * the caller then deletes the node through JPA as normal (which cascades the
 * tree beneath it, plus a lesson's images and videos).
 *
 * <h2>What is deleted and what refuses</h2>
 *
 * Authored content -- exams, questions, choices, the per-type question configs
 * -- is the admin's own material and goes without asking. Derived learner
 * progress (a read section, a completed-lesson mark, a saved library item)
 * goes too: it is a pointer at content that is about to stop existing, and
 * keeping it leaves rows describing a lesson nobody can open.
 *
 * <p>Graded records are different, and they stop the delete: an attempt, a
 * result, or an answered exam question is something a learner or the
 * institution that bought the certification is entitled to keep, and no
 * curriculum edit should be able to erase it. Those cases raise
 * {@link BusinessRuleException.CurriculumNodeInUseException} with the count, so
 * the admin is told what is in the way rather than being given a failed
 * request.
 */
@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class CurriculumSubtreeService {

    /** Which level of the curriculum a delete was asked for. */
    public enum Node {
        MAJOR("major category"),
        MIDDLE("module"),
        LESSON("lesson");

        private final String label;

        Node(String label) {
            this.label = label;
        }

        public String label() {
            return label;
        }
    }

    private final EntityManager entityManager;

    /**
     * Removes every row that would block deleting {@code id}, or refuses.
     *
     * Safe to call for a node that has nothing under it -- every statement is
     * bounded by a subquery that simply matches nothing.
     */
    public void clearFor(Node node, Long id) {
        String lessons = lessonScope(node);
        String exams = examScope(node, lessons);
        String questions = "SELECT question_id FROM questions WHERE lesson_id IN (" + lessons + ")";

        requireNoGradedRecords(node, id, exams, questions);

        // Anything the caller has already staged has to reach the database
        // before these native statements run, or the ordering they depend on
        // is only half true.
        entityManager.flush();

        // Exams first: exam_questions and exam_choices are what tie an exam to
        // the questions deleted below, so unpicking that link has to come
        // before either side of it.
        delete("DELETE FROM exam_choices WHERE exam_question_id IN ("
                + "SELECT exam_question_id FROM exam_questions WHERE exam_id IN (" + exams + "))", id);
        delete("DELETE FROM exam_questions WHERE exam_id IN (" + exams + ")", id);
        delete("DELETE FROM exams WHERE exam_id IN (" + exams + ")", id);

        // Then the questions and everything keyed on one. Test cases hang off
        // the programming config rather than the question, so they precede it.
        delete("DELETE FROM programming_test_cases WHERE programming_question_config_id IN ("
                + "SELECT programming_question_config_id FROM programming_question_configs "
                + "WHERE question_id IN (" + questions + "))", id);
        delete("DELETE FROM programming_question_configs WHERE question_id IN (" + questions + ")", id);
        delete("DELETE FROM diagram_question_configs WHERE question_id IN (" + questions + ")", id);
        delete("DELETE FROM text_question_configs WHERE question_id IN (" + questions + ")", id);
        delete("DELETE FROM question_rubric_criteria WHERE question_id IN (" + questions + ")", id);
        delete("DELETE FROM learner_mistake_reviews WHERE source_question_id IN (" + questions + ")", id);
        delete("DELETE FROM learner_review_items WHERE source_question_id IN (" + questions + ")", id);
        delete("DELETE FROM choices WHERE question_id IN (" + questions + ")", id);

        // Follow-up questions reference their parent, and a parent's children
        // are not guaranteed to sit under the same lesson -- so the edge is cut
        // by id rather than by relying on the scope to have caught both ends.
        delete("DELETE FROM questions WHERE parent_question_id IN (" + questions + ")", id);
        delete("DELETE FROM questions WHERE question_id IN (" + questions + ")", id);

        // Derived progress. Nothing here is a record of what a learner scored;
        // it is a bookmark into content that is going away.
        delete("DELETE FROM generated_study_sets WHERE lesson_id IN (" + lessons + ")", id);
        delete("DELETE FROM learner_practice_attempts WHERE lesson_id IN (" + lessons + ")", id);
        delete("DELETE FROM learner_read_sections WHERE lesson_id IN (" + lessons + ")", id);
        delete("DELETE FROM learner_library_items WHERE lesson_id IN (" + lessons + ")", id);
        delete("DELETE FROM learner_completed_lessons WHERE lesson_id IN (" + lessons + ")", id);

        // Lesson media is keyed on the lesson but is not one of the entity's
        // own cascaded collections, so JPA will not take it with the lesson.
        delete("DELETE FROM lesson_images WHERE lesson_id IN (" + lessons + ")", id);
        delete("DELETE FROM lesson_videos WHERE lesson_id IN (" + lessons + ")", id);

        // Native deletes are invisible to the persistence context, so anything
        // it is still holding now describes rows that are gone -- including the
        // questions cascaded from a Lesson. Callers delete the node by id after
        // this, against a context that has to reload what is actually there.
        entityManager.clear();

        log.info("Cleared content under {} id={}", node.label(), id);
    }

    /**
     * The graded records that make a node undeletable.
     *
     * Reported one at a time and most specific first, because "3 learners have
     * attempted an assessment under this module" is something an admin can act
     * on and "it is in use" is not.
     */
    private void requireNoGradedRecords(Node node, Long id, String exams, String questions) {
        refuseIfAny(
                "SELECT count(*) FROM assessment_attempts WHERE exam_id IN (" + exams + ")",
                id, node, "assessment attempt");
        refuseIfAny(
                "SELECT count(*) FROM exam_results WHERE exam_id IN (" + exams + ")",
                id, node, "recorded exam result");
        refuseIfAny(
                "SELECT count(*) FROM learner_exam_details WHERE exam_id IN (" + exams + ")"
                        + " OR question_id IN (" + questions + ")",
                id, node, "answered exam question");
    }

    private void refuseIfAny(String countSql, Long id, Node node, String what) {
        Number count = (Number) entityManager.createNativeQuery(countSql)
                .setParameter("nodeId", id)
                .getSingleResult();

        if (count == null || count.longValue() == 0) {
            return;
        }

        throw new BusinessRuleException.CurriculumNodeInUseException(
                "This %s cannot be deleted: it has %d %s%s from learners. Deleting it would remove their records."
                        .formatted(node.label(), count.longValue(), what, count.longValue() == 1 ? "" : "s"));
    }

    /** Every lesson under the node, as a subquery. */
    private String lessonScope(Node node) {
        return switch (node) {
            case LESSON -> "SELECT lesson_id FROM lessons WHERE lesson_id = :nodeId";
            case MIDDLE -> "SELECT lesson_id FROM lessons WHERE middle_category_id = :nodeId";
            case MAJOR -> "SELECT lesson_id FROM lessons WHERE middle_category_id IN ("
                    + "SELECT middle_category_id FROM middle_categories WHERE major_category_id = :nodeId)";
        };
    }

    /**
     * Every exam under the node, as a subquery.
     *
     * A category carries its own assessment as well as the quizzes of the
     * lessons beneath it, so both have to be in scope -- scoping by lesson
     * alone left the category assessment behind and the delete still failed.
     */
    private String examScope(Node node, String lessons) {
        return switch (node) {
            case LESSON -> "SELECT exam_id FROM exams WHERE lesson_id = :nodeId";
            case MIDDLE -> "SELECT exam_id FROM exams WHERE middle_category_id = :nodeId"
                    + " OR lesson_id IN (" + lessons + ")";
            case MAJOR -> "SELECT exam_id FROM exams WHERE major_category_id = :nodeId"
                    + " OR middle_category_id IN ("
                    + "SELECT middle_category_id FROM middle_categories WHERE major_category_id = :nodeId)"
                    + " OR lesson_id IN (" + lessons + ")";
        };
    }

    private void delete(String sql, Long id) {
        entityManager.createNativeQuery(sql).setParameter("nodeId", id).executeUpdate();
    }
}

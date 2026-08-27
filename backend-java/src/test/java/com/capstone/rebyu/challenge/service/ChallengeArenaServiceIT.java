package com.capstone.rebyu.challenge.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Exercises arena configuration against the real database.
 *
 * <p>An integration test rather than a unit test on purpose: what needed
 * proving is that a CHALLENGE exam can actually be created and found again --
 * the exam type is seeded at startup, the arena is identified by
 * {@code targetScope}, and the questions are real rows. Mocks would have
 * asserted only that the code calls the methods it obviously calls.
 *
 * <p>It leaves the arena configured on purpose. That is the state a learner
 * needs in order to see an arena unlock, so wiping it would remove the very
 * thing the next test looks for. {@code clearProblems} is exercised on a
 * second arena, so both directions are covered without leaving the first
 * unusable.
 */
@SpringBootTest
class ChallengeArenaServiceIT {

  /** Real PROGRAMMING questions on certification 2, found by surveying the bank. */
  private static final Long CODESTRIKE_CERTIFICATION = 2L;
  private static final List<Long> CODESTRIKE_QUESTIONS = List.of(69L);

  /** Real DIAGRAM questions, used to prove clearing works and locks again. */
  private static final Long BLUEPRINT_CERTIFICATION = 2L;
  private static final List<Long> BLUEPRINT_QUESTIONS = List.of(68L);

  @Autowired ChallengeArenaService arenas;
  @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;

  @Test
  void configuringAnArenaMakesItRunnable() {
    ChallengeArenaService.ArenaStatus before = arenas.status("codestrike");
    System.out.println("[arena] codestrike before: " + before);

    ChallengeArenaService.ArenaStatus after = arenas.saveProblems(
        "codestrike",
        new ChallengeArenaService.SaveArenaProblemsRequest(
            CODESTRIKE_CERTIFICATION,
            45,
            CODESTRIKE_QUESTIONS.stream()
                .map(id -> new ChallengeArenaService.ArenaProblemRequest(
                    id, 1, new BigDecimal("10")))
                .toList()));

    System.out.println("[arena] codestrike after:  " + after);

    assertTrue(after.configured(), "arena should be configured once it has problems");
    assertEquals(CODESTRIKE_QUESTIONS.size(), after.problemCount());
    assertNotNull(after.examId(), "a configured arena must expose the exam the learner runs");
    assertEquals(CODESTRIKE_CERTIFICATION, after.certificationId());

    /* Read back through SQL rather than the entity.
       `Exam.examType` is a lazy association, so touching it out here -- after
       the service's transaction has closed -- throws LazyInitializationException.
       That is a fact about the test, not about the arena, and making the test
       transactional would roll the save back and undo the very state a learner
       needs to see the arena unlock. */
    var row = jdbc.queryForMap(
        "SELECT e.status, e.target_scope, t.exam_type_text, "
            + "(SELECT count(*) FROM exam_questions q WHERE q.exam_id = e.exam_id) AS problems "
            + "FROM exams e JOIN exam_types t ON t.exam_type_id = e.exam_type_id "
            + "WHERE e.exam_id = ?",
        after.examId());

    assertEquals("CHALLENGE", row.get("exam_type_text"));
    assertEquals("codestrike", row.get("target_scope"));
    assertEquals("PUBLISHED", String.valueOf(row.get("status")));
    assertEquals(
        (long) CODESTRIKE_QUESTIONS.size(), ((Number) row.get("problems")).longValue());

    System.out.println("[arena] exam " + after.examId() + " -> " + row);
  }

  @Test
  void savingTwiceReplacesTheSetRatherThanGrowingIt() {
    arenas.saveProblems("blueprint", request(BLUEPRINT_QUESTIONS));
    ChallengeArenaService.ArenaStatus resaved =
        arenas.saveProblems("blueprint", request(BLUEPRINT_QUESTIONS));

    System.out.println("[arena] blueprint after two identical saves: " + resaved);
    assertEquals(BLUEPRINT_QUESTIONS.size(), resaved.problemCount(),
        "re-saving must replace the set, not append to it");
  }

  @Test
  void clearingAnArenaLocksItAgain() {
    arenas.saveProblems("blueprint", request(BLUEPRINT_QUESTIONS));
    assertTrue(arenas.status("blueprint").configured());

    ChallengeArenaService.ArenaStatus cleared = arenas.clearProblems("blueprint");
    System.out.println("[arena] blueprint cleared: " + cleared);

    assertFalse(cleared.configured(), "an emptied arena is locked for learners again");
    assertEquals(0, cleared.problemCount());
  }

  private static ChallengeArenaService.SaveArenaProblemsRequest request(List<Long> questionIds) {
    return new ChallengeArenaService.SaveArenaProblemsRequest(
        BLUEPRINT_CERTIFICATION,
        60,
        questionIds.stream()
            .map(id -> new ChallengeArenaService.ArenaProblemRequest(id, 1, new BigDecimal("10")))
            .toList());
  }
}

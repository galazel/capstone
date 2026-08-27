package com.capstone.rebyu.learningtools.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * What a learner's answering history says about which questions still need
 * work.
 *
 * <p>Extracted because two study activities ask the same question of the same
 * tables — Active Recall assembling a paper, and Spaced Repetition seeding a
 * review queue. Two copies of this SQL would drift, and the two features would
 * then disagree about what the learner is weak on while claiming to be built on
 * the same history.
 *
 * <p>Raw SQL rather than derived queries: "which source questions did this
 * learner get wrong" spans attempt → attempt-question → answer → exam →
 * certification and aggregates a count. There is no derived-query shape for
 * that, and the alternative is loading every answer the learner has ever given
 * and filtering in memory.
 */
@Service
@RequiredArgsConstructor
public class LearnerQuestionHistoryService {

  private final JdbcTemplate jdbc;

  /**
   * Questions this learner has answered incorrectly, worst first.
   *
   * <p>Ordered by how often a question has been missed before how recently it
   * was: a question missed four times is a worse gap than one missed once
   * yesterday.
   *
   * @param lessonId optional — narrows to one topic, for a session scheduled
   *                 against a specific lesson
   */
  @Transactional(readOnly = true)
  public List<Long> missedQuestionIds(Long learnerId, Long certificationId, Long lessonId) {
    StringBuilder sql = new StringBuilder("""
        SELECT aq.source_question_id
        FROM assessment_attempt_answers ans
        JOIN assessment_attempt_questions aq ON aq.attempt_question_id = ans.attempt_question_id
        JOIN assessment_attempts a ON a.assessment_attempt_id = ans.assessment_attempt_id
        JOIN exams e ON e.exam_id = a.exam_id
        LEFT JOIN questions q ON q.question_id = aq.source_question_id
        WHERE a.learner_id = ? AND a.status = 'SUBMITTED' AND ans.is_correct = false
          AND e.certification_id = ?
          AND aq.source_question_id IS NOT NULL
        """);

    List<Object> params = new ArrayList<>(List.of(learnerId, certificationId));

    if (lessonId != null) {
      sql.append(" AND coalesce(aq.lesson_id, q.lesson_id) = ?\n");
      params.add(lessonId);
    }

    sql.append("""
        GROUP BY aq.source_question_id
        ORDER BY count(*) DESC, max(a.submitted_at) DESC
        """);

    return jdbc.queryForList(sql.toString(), Long.class, params.toArray());
  }

  /**
   * Questions this learner has answered at all on a certification, most
   * recently first.
   *
   * <p>Spaced repetition reviews material already met — including material got
   * right, since the whole point is catching the moment something correct
   * starts to fade. Recall only ever wants the misses; this is the wider set.
   */
  @Transactional(readOnly = true)
  public List<Long> answeredQuestionIds(Long learnerId, Long certificationId) {
    return jdbc.queryForList("""
        SELECT aq.source_question_id
        FROM assessment_attempt_answers ans
        JOIN assessment_attempt_questions aq ON aq.attempt_question_id = ans.attempt_question_id
        JOIN assessment_attempts a ON a.assessment_attempt_id = ans.assessment_attempt_id
        JOIN exams e ON e.exam_id = a.exam_id
        WHERE a.learner_id = ? AND a.status = 'SUBMITTED'
          AND e.certification_id = ?
          AND aq.source_question_id IS NOT NULL
        GROUP BY aq.source_question_id
        ORDER BY max(a.submitted_at) DESC
        """, Long.class, learnerId, certificationId);
  }
}

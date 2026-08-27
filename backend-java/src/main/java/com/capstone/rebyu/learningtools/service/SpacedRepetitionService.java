package com.capstone.rebyu.learningtools.service;

import com.capstone.rebyu.assessment.entity.Question;
import com.capstone.rebyu.assessment.repository.QuestionRepository;
import com.capstone.rebyu.assessment.repository.QuestionSelectionView;
import com.capstone.rebyu.assessment.service.EligibleQuestionService;
import com.capstone.rebyu.learningtools.entity.LearnerReviewItem;
import com.capstone.rebyu.learningtools.repository.LearnerReviewItemRepository;
import com.capstone.rebyu.user.entity.Learner;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Spaced repetition: what is due for review today, and when each item comes
 * back.
 *
 * <h3>The algorithm</h3>
 * SM-2, the algorithm behind SuperMemo and Anki. Chosen over inventing a
 * schedule because the behaviour asked for — recalled material returning later,
 * forgotten material returning sooner — is exactly what it does, and it is
 * well understood enough that its numbers can be reasoned about rather than
 * tuned by guess.
 *
 * <p>The learner's four self-ratings map onto SM-2's quality scale:
 * {@code AGAIN}=2 (a lapse), {@code HARD}=3, {@code GOOD}=4, {@code EASY}=5.
 * These are the same four ratings the flashcard player already collects — a
 * field REBYU stored and never read. It is read now.
 *
 * <h3>Where items come from</h3>
 * A learner cannot review material they have never met, so the queue is seeded
 * from their own answering history: questions missed first, then anything else
 * they have answered on the certification. Seeding happens when a session runs
 * short, not on a schedule, so the queue only grows as fast as it is actually
 * worked through.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SpacedRepetitionService {

  /** SM-2's starting ease, and the floor it may never drop through. */
  private static final double INITIAL_EASE = 2.5;
  private static final double MINIMUM_EASE = 1.3;

  private static final int DEFAULT_SIZE = 20;
  private static final int MAX_SIZE = 50;

  /** The interval after a first and second successful recall, in days. */
  private static final int FIRST_INTERVAL = 1;
  private static final int SECOND_INTERVAL = 6;

  private final LearnerReviewItemRepository reviewItems;
  private final LearnerQuestionHistoryService history;
  private final EligibleQuestionService eligibleQuestions;
  private final QuestionRepository questions;
  private final JdbcTemplate jdbc;

  /** One card in a review session. */
  public record ReviewCard(
      Long questionId,
      String question,
      String answer,
      String explanation,
      String lessonTitle,
      int repetitions,
      LocalDate dueOn) {}

  public record ReviewQueue(List<ReviewCard> cards, int dueCount, boolean seeded) {}

  public record ReviewOutcome(
      Long questionId, String grade, int repetitions, int intervalDays,
      double easeFactor, LocalDate dueOn) {}

  /**
   * What the learner should review now.
   *
   * <p>Items already due come first and in due order — the longest overdue is
   * the most likely to have decayed. Only if that leaves the session short is
   * anything new pulled in, so a learner with a real backlog works through the
   * backlog rather than being handed fresh material on top of it.
   */
  @Transactional
  public ReviewQueue dueCards(Long learnerId, Long certificationId, Long lessonId, Integer size) {
    if (certificationId == null) {
      throw new IllegalArgumentException("A certification is required for a review session");
    }
    int target = size == null ? DEFAULT_SIZE : Math.min(Math.max(size, 1), MAX_SIZE);
    LocalDate today = LocalDate.now();

    List<LearnerReviewItem> due = reviewItems
        .findByLearner_LearnerIdAndCertificationIdAndDueOnLessThanEqualOrderByDueOnAsc(
            learnerId, certificationId, today);

    // The scheduled topic first when the plan named one, without dropping the
    // rest -- an overdue item elsewhere is still overdue.
    if (lessonId != null) {
      due = new ArrayList<>(due);
      due.sort((a, b) -> {
        boolean aTopic = lessonId.equals(a.getLessonId());
        boolean bTopic = lessonId.equals(b.getLessonId());
        if (aTopic != bTopic) return aTopic ? -1 : 1;
        return a.getDueOn().compareTo(b.getDueOn());
      });
    }

    int dueCount = due.size();
    List<LearnerReviewItem> session = new ArrayList<>(due.subList(0, Math.min(target, due.size())));

    boolean seeded = false;
    if (session.size() < target) {
      List<LearnerReviewItem> fresh =
          seed(learnerId, certificationId, lessonId, target - session.size(), today);
      seeded = !fresh.isEmpty();
      session.addAll(fresh);
    }

    return new ReviewQueue(toCards(session), dueCount, seeded);
  }

  /**
   * Records how well an item was recalled and schedules its return.
   *
   * <p>The item is created on the spot if it is not tracked yet: a card can be
   * graded straight out of a freshly seeded session, and requiring a separate
   * "start tracking" call would just be a round trip that can fail halfway.
   */
  @Transactional
  public ReviewOutcome grade(Long learnerId, Long questionId, String grade) {
    int quality = qualityOf(grade);

    LearnerReviewItem item = reviewItems
        .findByLearner_LearnerIdAndSourceQuestion_QuestionId(learnerId, questionId)
        .orElseGet(() -> {
          Question question = questions.findById(questionId)
              .orElseThrow(() -> new EntityNotFoundException("Question not found: " + questionId));
          return newItem(learnerId, question, LocalDate.now());
        });

    apply(item, quality, LocalDate.now());
    LearnerReviewItem saved = reviewItems.save(item);

    return new ReviewOutcome(questionId, grade.trim().toUpperCase(), saved.getRepetitions(),
        saved.getIntervalDays(), saved.getEaseFactor(), saved.getDueOn());
  }

  /**
   * SM-2, applied in place.
   *
   * <p>A lapse (quality below 3) resets the repetition count and brings the
   * item back tomorrow — that is the whole "forgotten material returns sooner"
   * half of the behaviour. Ease is adjusted on every review including lapses,
   * so an item the learner repeatedly fails keeps shortening its own intervals
   * rather than bouncing back to a six-day gap the moment it is recalled once.
   */
  private void apply(LearnerReviewItem item, int quality, LocalDate today) {
    double ease = item.getEaseFactor() <= 0 ? INITIAL_EASE : item.getEaseFactor();

    // SM-2's ease adjustment, verbatim: a perfect recall nudges ease up, a
    // laboured one drags it down, and the curve steepens the worse it gets.
    ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    item.setEaseFactor(Math.max(MINIMUM_EASE, ease));

    if (quality < 3) {
      item.setLapses(item.getLapses() + 1);
      item.setRepetitions(0);
      item.setIntervalDays(FIRST_INTERVAL);
    } else {
      int repetitions = item.getRepetitions();
      int interval = repetitions == 0
          ? FIRST_INTERVAL
          : repetitions == 1
              ? SECOND_INTERVAL
              : (int) Math.max(1, Math.round(item.getIntervalDays() * item.getEaseFactor()));

      item.setRepetitions(repetitions + 1);
      item.setIntervalDays(interval);
    }

    item.setDueOn(today.plusDays(item.getIntervalDays()));
    item.setLastReviewedAt(LocalDateTime.now());
    item.setUpdatedAt(LocalDateTime.now());
  }

  /** Adds untracked questions to the queue, missed ones first. */
  private List<LearnerReviewItem> seed(
      Long learnerId, Long certificationId, Long lessonId, int wanted, LocalDate today) {

    Set<Long> candidates = new LinkedHashSet<>();
    candidates.addAll(history.missedQuestionIds(learnerId, certificationId, lessonId));
    candidates.addAll(history.missedQuestionIds(learnerId, certificationId, null));
    candidates.addAll(history.answeredQuestionIds(learnerId, certificationId));

    // Only when the learner has answered nothing yet: reviewing material never
    // seen is not review, so this is a last resort rather than a normal source.
    if (candidates.isEmpty() && lessonId != null) {
      candidates.addAll(scopeQuestionIds(lessonId));
    }

    if (candidates.isEmpty()) {
      return List.of();
    }

    Set<Long> tracked = reviewItems.findTrackedQuestionIds(learnerId, candidates);

    List<LearnerReviewItem> created = new ArrayList<>();
    for (Long questionId : candidates) {
      if (created.size() >= wanted) break;
      if (tracked.contains(questionId)) continue;

      Question question = questions.findById(questionId).orElse(null);
      if (question == null) continue;

      created.add(reviewItems.save(newItem(learnerId, question, today)));
    }

    if (!created.isEmpty()) {
      log.info("Seeded {} review item(s) for learner {} on certification {}",
          created.size(), learnerId, certificationId);
    }
    return created;
  }

  private LearnerReviewItem newItem(Long learnerId, Question question, LocalDate today) {
    LearnerReviewItem item = new LearnerReviewItem();
    item.setLearner(Learner.builder().learnerId(learnerId).build());
    item.setSourceQuestion(question);
    item.setLessonId(question.getLesson() == null ? null : question.getLesson().getLessonId());
    item.setCertificationId(certificationIdOf(question));
    item.setRepetitions(0);
    item.setIntervalDays(0);
    item.setEaseFactor(INITIAL_EASE);
    // Due immediately: it was pulled in because it needs reviewing now.
    item.setDueOn(today);
    item.setLapses(0);
    item.setCreatedAt(LocalDateTime.now());
    item.setUpdatedAt(LocalDateTime.now());
    return item;
  }

  private static Long certificationIdOf(Question question) {
    if (question.getLesson() == null
        || question.getLesson().getMiddleCategory() == null
        || question.getLesson().getMiddleCategory().getMajorCategory() == null) {
      return null;
    }
    return question.getLesson().getMiddleCategory().getMajorCategory()
        .getCertification().getCertificationId();
  }

  private List<Long> scopeQuestionIds(Long lessonId) {
    return eligibleQuestions.resolveScopeViews(null, null, null, lessonId).stream()
        .filter(view -> view.getOwnerGroupId() == null)
        .map(QuestionSelectionView::getQuestionId)
        .toList();
  }

  /**
   * Turns tracked items into answerable cards.
   *
   * <p>The answer is resolved the same way the mistakes bank resolves it — a
   * short-answer config's answer, else the correct choice's text. Showing it is
   * the point: a review card is revealed and self-rated, not marked. One query
   * for the whole session rather than per card.
   */
  private List<ReviewCard> toCards(List<LearnerReviewItem> items) {
    if (items.isEmpty()) return List.of();

    List<Long> questionIds = items.stream()
        .map(item -> item.getSourceQuestion().getQuestionId())
        .toList();

    String placeholders = questionIds.stream().map(id -> "?").collect(Collectors.joining(","));

    Map<Long, Map<String, Object>> byQuestion = jdbc.query("""
        SELECT q.question_id,
               q.question_text,
               coalesce(tc.correct_answer, correct_choice.choice_text) answer,
               l.name lesson_title
        FROM questions q
        LEFT JOIN text_question_configs tc ON tc.question_id = q.question_id
        LEFT JOIN choices correct_choice
            ON correct_choice.question_id = q.question_id AND correct_choice.is_correct = true
        LEFT JOIN lessons l ON l.lesson_id = q.lesson_id
        WHERE q.question_id IN (%s)
        """.formatted(placeholders), rs -> {
      Map<Long, Map<String, Object>> rows = new java.util.HashMap<>();
      while (rs.next()) {
        rows.put(rs.getLong("question_id"), Map.of(
            "question", String.valueOf(rs.getString("question_text")),
            "answer", String.valueOf(rs.getString("answer")),
            "lessonTitle", String.valueOf(rs.getString("lesson_title"))));
      }
      return rows;
    }, questionIds.toArray());

    List<ReviewCard> cards = new ArrayList<>();
    for (LearnerReviewItem item : items) {
      Long questionId = item.getSourceQuestion().getQuestionId();
      Map<String, Object> row = byQuestion == null ? null : byQuestion.get(questionId);
      if (row == null) continue;

      String answer = String.valueOf(row.get("answer"));
      cards.add(new ReviewCard(
          questionId,
          String.valueOf(row.get("question")),
          "null".equals(answer) ? null : answer,
          null,
          "null".equals(String.valueOf(row.get("lessonTitle"))) ? null : String.valueOf(row.get("lessonTitle")),
          item.getRepetitions(),
          item.getDueOn()));
    }
    return cards;
  }

  /** The learner's rating, on SM-2's 0–5 quality scale. */
  private static int qualityOf(String grade) {
    return switch (grade == null ? "" : grade.trim().toUpperCase()) {
      case "AGAIN" -> 2;
      case "HARD" -> 3;
      case "GOOD" -> 4;
      case "EASY" -> 5;
      default -> throw new IllegalArgumentException(
          "Grade must be one of AGAIN, HARD, GOOD, EASY -- got: " + grade);
    };
  }
}

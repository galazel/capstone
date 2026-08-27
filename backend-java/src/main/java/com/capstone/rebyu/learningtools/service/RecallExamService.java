package com.capstone.rebyu.learningtools.service;

import com.capstone.rebyu.assessment.entity.Exam;
import com.capstone.rebyu.assessment.entity.ExamQuestion;
import com.capstone.rebyu.assessment.entity.ExamType;
import com.capstone.rebyu.assessment.entity.Question;
import com.capstone.rebyu.assessment.repository.ExamQuestionRepository;
import com.capstone.rebyu.assessment.repository.ExamRepository;
import com.capstone.rebyu.assessment.repository.ExamTypeRepository;
import com.capstone.rebyu.assessment.repository.QuestionRepository;
import com.capstone.rebyu.assessment.repository.QuestionSelectionView;
import com.capstone.rebyu.assessment.service.EligibleQuestionService;
import com.capstone.rebyu.bkt.dto.LessonPriorityView;
import com.capstone.rebyu.bkt.service.LearnerMasteryService;
import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.repository.CertificationRepository;
import com.capstone.rebyu.user.entity.Learner;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Assembles the study plan's Active Recall session: an exam built out of what
 * this learner has actually struggled with.
 *
 * <h3>Why it is a real exam</h3>
 * The attempt engine has no exam-less path -- {@code AssessmentAttempt.exam} is
 * a non-null FK and {@code startAttempt} refuses anything that is not a
 * PUBLISHED exam with questions. Minting a real, learner-owned exam (the same
 * thing the AI tutor's practice quizzes do, see {@link GeneratedAssessmentService})
 * means the whole existing machinery applies unchanged: the attempt runner,
 * grading, the lesson breakdown, XP, and the BKT mastery events a recall
 * session ought to feed back into.
 *
 * <p>Unlike that service, this one assembles <em>existing</em> questions rather
 * than authoring new ones. Recall is only meaningful against material the
 * learner has already met -- inventing fresh questions would test something
 * else entirely.
 *
 * <h3>What gets picked</h3>
 * In order, until the paper is full:
 * <ol>
 *   <li>questions from the scheduled topic that were answered incorrectly</li>
 *   <li>anything else answered incorrectly on this certification, most-missed
 *       first</li>
 *   <li>questions from the weakest lessons by BKT mastery</li>
 *   <li>anything else from the scheduled topic</li>
 *   <li>anything else on the certification, so a paper is still produced for a
 *       learner with no history yet</li>
 * </ol>
 * Each tier only fills what the ones above it left, so a learner with thirty
 * outstanding mistakes sits twenty of those and never reaches the filler.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RecallExamService {

  public static final String RECALL_EXAM_TYPE = "RECALL";

  /**
   * Stamped instead of a curriculum scope, for the same reason
   * {@link GeneratedAssessmentService#GENERATED_TARGET_SCOPE} is: a value that
   * is not "LESSON" keeps this paper out of uniqueness checks and out of the
   * curriculum UI's lesson-quiz tiles. A recall session is the learner's own,
   * and must never look like the certification's official assessment.
   */
  public static final String RECALL_TARGET_SCOPE = "RECALL";

  private static final int DEFAULT_SIZE = 20;
  private static final int MAX_SIZE = 50;

  /** Below this mastery a lesson is worth re-testing. */
  private static final double WEAK_MASTERY_CEILING = 0.7;

  private final LearnerQuestionHistoryService history;
  private final ExamRepository exams;
  private final ExamTypeRepository examTypes;
  private final ExamQuestionRepository examQuestions;
  private final QuestionRepository questions;
  private final CertificationRepository certifications;
  private final EligibleQuestionService eligibleQuestions;
  private final LearnerMasteryService mastery;

  public record RecallExam(
      Long examId, String title, Long certificationId, int itemCount, String basis) {}

  @Transactional
  public RecallExam createRecallExam(Long learnerId, Long certificationId, Long lessonId, Integer size) {
    if (certificationId == null) {
      throw new IllegalArgumentException("A certification is required to build a recall session");
    }

    int target = size == null ? DEFAULT_SIZE : Math.min(Math.max(size, 1), MAX_SIZE);

    Certification certification = certifications.findById(certificationId)
        .orElseThrow(() -> new EntityNotFoundException("Certification not found: " + certificationId));

    /* Ordered, de-duplicating, and capped as it fills: a LinkedHashSet is what
       makes "each tier fills only what the ones above left" fall out of the
       insertion order rather than needing bookkeeping per tier. */
    Set<Long> chosen = new LinkedHashSet<>();
    String basis = "history";

    List<Long> missedInTopic = lessonId == null ? List.of() : missedQuestionIds(learnerId, certificationId, lessonId);
    addUpTo(chosen, missedInTopic, target);

    addUpTo(chosen, missedQuestionIds(learnerId, certificationId, null), target);

    if (chosen.size() < target) {
      addUpTo(chosen, weakLessonQuestionIds(learnerId, certificationId, chosen), target);
    }

    if (chosen.size() < target && lessonId != null) {
      addUpTo(chosen, scopeQuestionIds(null, lessonId), target);
    }

    if (chosen.size() < target) {
      // Nothing to recall yet -- a first-time learner still gets a paper, and
      // the basis says why, so the UI can be honest about what this is.
      if (chosen.isEmpty()) {
        basis = "coverage";
      }
      addUpTo(chosen, scopeQuestionIds(certificationId, null), target);
    }

    if (chosen.isEmpty()) {
      throw new IllegalStateException(
          "This certification has no questions to build a recall session from");
    }

    ExamType examType = examTypes.findByExamTypeText(RECALL_EXAM_TYPE)
        .orElseThrow(() -> new IllegalStateException(
            "Exam type '" + RECALL_EXAM_TYPE + "' is not seeded -- see ExamTypeSeeder"));

    LocalDateTime now = LocalDateTime.now();
    Exam exam = exams.save(Exam.builder()
        .certification(certification)
        .examType(examType)
        .title("Active recall · " + now.toLocalDate())
        .isGenerated(true)
        .learner(Learner.builder().learnerId(learnerId).build())
        .totalQuestions(chosen.size())
        .passingScore(new BigDecimal("70.00"))
        .status(Exam.Status.PUBLISHED)
        .targetScope(RECALL_TARGET_SCOPE)
        .publishedAt(now)
        .updatedAt(now)
        // The point of recall is finding out what you no longer know, which is
        // worthless without being told immediately which ones those were.
        .releaseAnswersAfterSubmit(true)
        .build());

    int displayOrder = 1;
    for (Long questionId : chosen) {
      Question question = questions.getReferenceById(questionId);
      examQuestions.save(ExamQuestion.builder()
          .exam(exam)
          .question(question)
          .displayOrder(displayOrder++)
          .build());
    }

    log.info("Recall exam {} built for learner {} on certification {} ({} items, basis {})",
        exam.getExamId(), learnerId, certificationId, chosen.size(), basis);

    return new RecallExam(
        exam.getExamId(), exam.getTitle(), certificationId, chosen.size(), basis);
  }

  private List<Long> missedQuestionIds(Long learnerId, Long certificationId, Long lessonId) {
    return history.missedQuestionIds(learnerId, certificationId, lessonId);
  }

  /**
   * Questions from the lessons BKT rates weakest.
   *
   * <p>Degrades to nothing when the BKT service is unavailable rather than
   * failing the request: a recall session built only from past mistakes is a
   * worse session, not a broken one, and refusing to start would make an
   * optional study feature depend on an optional service being up.
   */
  private List<Long> weakLessonQuestionIds(Long learnerId, Long certificationId, Set<Long> alreadyChosen) {
    LearnerMasteryService.LessonPrioritiesResult priorities =
        mastery.getLessonPrioritiesForAnalytics(learnerId, certificationId);

    if (!priorities.available() || priorities.lessons() == null) {
      return List.of();
    }

    List<Long> weakestLessonIds = priorities.lessons().stream()
        .filter(lesson -> lesson.lessonId() != null)
        .filter(lesson -> lesson.masteryProbability() == null
            || lesson.masteryProbability() < WEAK_MASTERY_CEILING)
        .sorted(Comparator.comparingDouble(
            lesson -> lesson.masteryProbability() == null ? 0d : lesson.masteryProbability()))
        .map(LessonPriorityView::lessonId)
        .toList();

    List<Long> picked = new ArrayList<>();
    for (Long weakLessonId : weakestLessonIds) {
      for (Long questionId : scopeQuestionIds(null, weakLessonId)) {
        if (!alreadyChosen.contains(questionId)) {
          picked.add(questionId);
        }
      }
    }
    return picked;
  }

  /** Every official question in a scope, as ids only. */
  private List<Long> scopeQuestionIds(Long certificationId, Long lessonId) {
    return eligibleQuestions.resolveScopeViews(certificationId, null, null, lessonId).stream()
        // Another institution group's private questions are never eligible
        // here: this paper is assembled for the learner, with no group context
        // to check them against.
        .filter(view -> view.getOwnerGroupId() == null)
        .map(QuestionSelectionView::getQuestionId)
        .toList();
  }

  private static void addUpTo(Set<Long> chosen, List<Long> candidates, int target) {
    for (Long candidate : candidates) {
      if (chosen.size() >= target) return;
      if (candidate != null) chosen.add(candidate);
    }
  }

  /** Diagnostics for the caller, kept out of the response contract. */
  public Map<String, Object> describe(RecallExam exam) {
    return Map.of("examId", exam.examId(), "itemCount", exam.itemCount(), "basis", exam.basis());
  }
}

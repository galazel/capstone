package com.capstone.rebyu.challenge.service;

import com.capstone.rebyu.assessment.entity.Exam;
import com.capstone.rebyu.assessment.entity.ExamQuestion;
import com.capstone.rebyu.assessment.entity.ExamType;
import com.capstone.rebyu.assessment.entity.Question;
import com.capstone.rebyu.assessment.repository.ExamQuestionRepository;
import com.capstone.rebyu.assessment.repository.ExamRepository;
import com.capstone.rebyu.assessment.repository.ExamTypeRepository;
import com.capstone.rebyu.assessment.repository.QuestionRepository;
import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.repository.CertificationRepository;
import com.capstone.rebyu.challenge.entity.ChallengeArenaIndustry;
import com.capstone.rebyu.challenge.repository.ChallengeArenaIndustryRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * The IT Olympics arenas, and the problems an admin configures into them.
 *
 * <h3>An arena's problem set is an exam</h3>
 * One {@code CHALLENGE} exam per arena. That is not a workaround -- it is what
 * makes a challenge runnable at all. The attempt engine already starts, saves,
 * submits and grades an exam, and it already grades the two question types the
 * solo arenas are made of: PROGRAMMING through Judge0 and DIAGRAM through the
 * structural grader. Modelling arena problems separately would have meant
 * writing both a second time, and they would have drifted.
 *
 * <p>The arena is named by {@code targetScope} -- "codestrike", "blueprint",
 * "worldcup" -- the same way generated practice exams mark themselves with
 * "GENERATED". {@code examType} says it is a challenge; {@code targetScope}
 * says which one.
 *
 * <h3>Configured, and what it gates</h3>
 * An arena is configured when its exam exists and holds at least one question.
 * Until then the learner's view keeps it locked: an arena with no problems is
 * not a hard challenge, it is a run that opens onto nothing, and letting a
 * learner in to discover that is worse than saying so on the card.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChallengeArenaService {

  public static final String CHALLENGE_EXAM_TYPE = "CHALLENGE";

  /** The arenas that exist. Not data: each is a built surface with its own run. */
  public static final List<String> ARENA_IDS = List.of("codestrike", "blueprint", "worldcup");

  private final ExamRepository exams;
  private final ExamTypeRepository examTypes;
  private final ExamQuestionRepository examQuestions;
  private final QuestionRepository questions;
  private final CertificationRepository certifications;
  private final ChallengeArenaIndustryRepository arenaIndustries;

  /** What the learner's card and the admin list both read. */
  public record ArenaStatus(
      String arenaId,
      boolean configured,
      int problemCount,
      Long examId,
      Long certificationId,
      List<String> industries) {}

  /** One problem as the admin hands it over: a question already saved to the bank. */
  public record ArenaProblemRequest(Long questionId, Integer nodeIndex, BigDecimal points) {}

  public record SaveArenaProblemsRequest(
      Long certificationId, Integer timeLimitMinutes, List<ArenaProblemRequest> problems) {}

  @Transactional(readOnly = true)
  public List<ArenaStatus> statuses() {
    return ARENA_IDS.stream().map(this::status).toList();
  }

  @Transactional(readOnly = true)
  public ArenaStatus status(String arenaId) {
    List<String> industries = arenaIndustries.findByArenaIdOrderByIndustryAsc(arenaId).stream()
        .map(ChallengeArenaIndustry::getIndustry)
        .toList();

    Exam exam = findArenaExam(arenaId);
    if (exam == null) {
      return new ArenaStatus(arenaId, false, 0, null, null, industries);
    }

    int count = examQuestions.findByExam_ExamIdOrderByDisplayOrderAsc(exam.getExamId()).size();
    return new ArenaStatus(
        arenaId,
        count > 0,
        count,
        exam.getExamId(),
        exam.getCertification() == null ? null : exam.getCertification().getCertificationId(),
        industries);
  }

  /**
   * Replaces an arena's problem set.
   *
   * <p>Replace rather than append: the builder edits the whole set on one
   * screen and saves it whole, so a merge would leave behind problems the admin
   * had just deleted and believed were gone.
   */
  @Transactional
  public ArenaStatus saveProblems(String arenaId, SaveArenaProblemsRequest request) {
    requireKnownArena(arenaId);

    if (request == null || request.problems() == null || request.problems().isEmpty()) {
      throw new IllegalArgumentException("An arena needs at least one problem");
    }
    if (request.certificationId() == null) {
      throw new IllegalArgumentException("Choose the certification these problems come from");
    }

    Certification certification = certifications.findById(request.certificationId())
        .orElseThrow(() -> new EntityNotFoundException(
            "Certification not found: " + request.certificationId()));

    Exam exam = findArenaExam(arenaId);
    LocalDateTime now = LocalDateTime.now();

    if (exam == null) {
      ExamType examType = examTypes.findByExamTypeText(CHALLENGE_EXAM_TYPE)
          .orElseThrow(() -> new IllegalStateException(
              "Exam type CHALLENGE is not seeded -- see ExamTypeSeeder"));

      exam = new Exam();
      exam.setExamType(examType);
      exam.setTargetScope(arenaId);
      exam.setTitle(titleFor(arenaId));
      // Answers are released after submitting: an arena run is practice against
      // a judge, and a learner who cannot see what they got wrong learns
      // nothing from having run it.
      exam.setReleaseAnswersAfterSubmit(true);
      exam.setPassingScore(new BigDecimal("70.00"));
      exam.setStatus(Exam.Status.PUBLISHED);
      exam.setPublishedAt(now);
    }

    exam.setCertification(certification);
    exam.setDurationMinutes(
        request.timeLimitMinutes() == null || request.timeLimitMinutes() <= 0
            ? null
            : request.timeLimitMinutes());
    exam.setTotalQuestions(request.problems().size());
    exam.setUpdatedAt(now);
    exam = exams.save(exam);

    // Out with the previous set before the new one goes in, so display order
    // cannot collide with rows that are about to be removed.
    examQuestions.deleteAll(examQuestions.findByExam_ExamIdOrderByDisplayOrderAsc(exam.getExamId()));

    int order = 1;
    for (ArenaProblemRequest problem : request.problems()) {
      if (problem.questionId() == null) {
        throw new IllegalArgumentException("Every arena problem needs a question");
      }
      Question question = questions.findById(problem.questionId())
          .orElseThrow(() -> new EntityNotFoundException(
              "Question not found: " + problem.questionId()));

      examQuestions.save(ExamQuestion.builder()
          .exam(exam)
          .question(question)
          .displayOrder(order++)
          .build());
    }

    log.info("Arena {} configured with {} problem(s) on certification {}",
        arenaId, request.problems().size(), certification.getCertificationId());

    return status(arenaId);
  }

  /**
   * Replaces the industries allowed into an arena.
   *
   * <p>Replaced rather than merged, because the dialog submits the full set of
   * checkboxes rather than a change to it. Saving with nothing selected is a
   * real instruction -- "no industry is assigned" -- not an empty request to
   * ignore.
   */
  @Transactional
  public ArenaStatus setIndustries(String arenaId, List<String> industries) {
    requireKnownArena(arenaId);

    arenaIndustries.deleteByArenaId(arenaId);

    for (String industry : industries == null ? List.<String>of() : industries) {
      if (industry == null || industry.isBlank()) {
        continue;
      }
      ChallengeArenaIndustry row = new ChallengeArenaIndustry();
      row.setArenaId(arenaId);
      row.setIndustry(industry.trim());
      arenaIndustries.save(row);
    }

    log.info("Arena {} assigned to {} industr(y/ies)", arenaId,
        industries == null ? 0 : industries.size());
    return status(arenaId);
  }

  /** Removes an arena's problem set, which locks it again for learners. */
  @Transactional
  public ArenaStatus clearProblems(String arenaId) {
    requireKnownArena(arenaId);
    Exam exam = findArenaExam(arenaId);
    if (exam != null) {
      examQuestions.deleteAll(
          examQuestions.findByExam_ExamIdOrderByDisplayOrderAsc(exam.getExamId()));
      exam.setTotalQuestions(0);
      exams.save(exam);
    }
    return status(arenaId);
  }

  private Exam findArenaExam(String arenaId) {
    return exams.findAll().stream()
        .filter(exam -> exam.getExamType() != null
            && CHALLENGE_EXAM_TYPE.equals(exam.getExamType().getExamTypeText()))
        .filter(exam -> arenaId.equals(exam.getTargetScope()))
        .findFirst()
        .orElse(null);
  }

  private static void requireKnownArena(String arenaId) {
    if (!ARENA_IDS.contains(arenaId)) {
      throw new IllegalArgumentException("Unknown arena: " + arenaId);
    }
  }

  private static String titleFor(String arenaId) {
    return Map.of(
        "codestrike", "CodeStrike",
        "blueprint", "Blueprint Arena",
        "worldcup", "World Cup").getOrDefault(arenaId, arenaId);
  }
}

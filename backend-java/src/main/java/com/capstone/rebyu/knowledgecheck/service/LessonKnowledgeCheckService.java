package com.capstone.rebyu.knowledgecheck.service;

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
import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.certification.repository.LessonRepository;
import com.capstone.rebyu.knowledgecheck.dto.KnowledgeCheckDtos.CheckOffer;
import com.capstone.rebyu.learningtools.service.LearnerQuestionHistoryService;
import com.capstone.rebyu.progress.entity.LearnerCompletedLesson;
import com.capstone.rebyu.progress.repository.LearnerCompletedLessonRepository;
import com.capstone.rebyu.user.entity.Learner;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

/**
 * The pop-up knowledge check: five questions drawn from lessons this learner has
 * already finished, served while they are part-way through reading a different
 * one.
 *
 * <h3>Why it is a real exam</h3>
 * The same reason {@code RecallExamService} mints one. A check can contain any
 * question type the bank holds -- multiple choice, true/false, short answer,
 * descriptive, programming, diagram -- and the graders for those live in the
 * attempt engine, keyed off {@code AssessmentAttempt}. Hand-rolling a second
 * scoring path here would mean reimplementing exact-match and AI-semantic short
 * answer, rubric-graded descriptive, Judge0 programming and structural diagram
 * marking, and then keeping all five in step with the originals forever.
 * Minting the exam means grading, XP, the lesson breakdown and the BKT mastery
 * events all apply unchanged.
 *
 * <h3>What gets picked</h3>
 * Only lessons the learner has actually completed, preferring the certification
 * they are currently reading, and never the lesson they are reading right now --
 * a check is recall of finished material, and quizzing someone on the page in
 * front of them is a reading-comprehension test instead.
 *
 * <p>Within that pool the questions are chosen weakness-first: anything the
 * learner has previously answered incorrectly, on any submitted assessment,
 * worst-missed first. The question bank fills whatever is left. See
 * {@link #selectQuestions} for why.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LessonKnowledgeCheckService {

    public static final String KNOWLEDGE_CHECK_EXAM_TYPE = "KNOWLEDGE_CHECK";

    /**
     * Keeps the paper out of the per-scope uniqueness checks and out of the
     * curriculum UI's lesson-quiz tiles, exactly as {@code RECALL} does. The
     * check is the learner's own and must never look like the certification's
     * official assessment.
     */
    public static final String KNOWLEDGE_CHECK_TARGET_SCOPE = "KNOWLEDGE_CHECK";

    /** Five, as specified. The modal copy is written around five. */
    private static final int CHECK_SIZE = 5;

    /**
     * How long after one check before another may fire: one per day.
     *
     * <p>This is the setting that decides whether the feature is welcome or
     * hated, so it is deliberately generous. A learner opening six lessons in
     * an evening is studying hard, and interrupting each one would punish
     * exactly the behaviour the product wants. At a day, the check is a thing
     * that happens once and is over, not a toll on every lesson.
     *
     * <p>A rolling 24 hours from the last check rather than a calendar day:
     * a calendar boundary would let someone checked at 23:50 be checked again
     * at 00:05, which is the same annoyance wearing a different hat.
     */
    private static final Duration COOLDOWN = Duration.ofDays(1);

    private final LearnerCompletedLessonRepository completedLessons;
    private final LessonRepository lessons;
    private final EligibleQuestionService eligibleQuestions;
    private final ExamRepository exams;
    private final ExamTypeRepository examTypes;
    private final ExamQuestionRepository examQuestions;
    private final QuestionRepository questions;
    private final LearnerQuestionHistoryService history;

    /**
     * Whether a check can be served right now, and the material it would be
     * built from. Read-only: the frontend asks this before deciding to
     * interrupt, so a learner who is not eligible is never shown a modal that
     * then fails to build.
     */
    @Transactional(readOnly = true)
    public CheckOffer offer(Long learnerId, Long triggerLessonId) {
        Lesson trigger = requireLesson(triggerLessonId);

        if (onCooldown(learnerId)) {
            return CheckOffer.unavailable("cooldown");
        }

        Candidates candidates = candidateQuestions(learnerId, trigger);
        if (candidates.questionIds().size() < CHECK_SIZE) {
            // Not enough finished material to test yet. Said plainly so the
            // frontend can stop asking rather than retrying on every scroll.
            return CheckOffer.unavailable("not-enough-completed-lessons");
        }

        return CheckOffer.available(CHECK_SIZE, candidates.lessonNames());
    }

    /**
     * Mints the check and returns the exam to sit. Eligibility is re-checked
     * here rather than trusted from the frontend, so a client that skips
     * {@link #offer} cannot mint checks in a loop and farm the XP.
     */
    @Transactional
    public CheckOffer create(Long learnerId, Long triggerLessonId) {
        Lesson trigger = requireLesson(triggerLessonId);

        if (onCooldown(learnerId)) {
            return CheckOffer.unavailable("cooldown");
        }

        Candidates candidates = candidateQuestions(learnerId, trigger);
        if (candidates.questionIds().size() < CHECK_SIZE) {
            return CheckOffer.unavailable("not-enough-completed-lessons");
        }

        List<Long> chosen = selectQuestions(learnerId, candidates);

        Certification certification = certificationOf(trigger);

        ExamType examType = examTypes.findByExamTypeText(KNOWLEDGE_CHECK_EXAM_TYPE)
                .orElseThrow(() -> new IllegalStateException(
                        "Exam type '" + KNOWLEDGE_CHECK_EXAM_TYPE
                                + "' is not seeded -- see ExamTypeSeeder"));

        LocalDateTime now = LocalDateTime.now();
        Exam exam = exams.save(Exam.builder()
                .certification(certification)
                .examType(examType)
                .title("Knowledge check")
                .isGenerated(true)
                .learner(Learner.builder().learnerId(learnerId).build())
                .totalQuestions(chosen.size())
                .passingScore(new BigDecimal("60.00"))
                .status(Exam.Status.PUBLISHED)
                .targetScope(KNOWLEDGE_CHECK_TARGET_SCOPE)
                .publishedAt(now)
                .updatedAt(now)
                // The whole point is finding out what has faded, which is
                // worthless without being told immediately which ones those
                // were -- the same call the recall session makes.
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

        log.info("Knowledge check {} minted for learner {} on certification {} "
                        + "({} items from {} completed lesson(s), triggered on lesson {})",
                exam.getExamId(), learnerId, certification.getCertificationId(),
                chosen.size(), candidates.lessonNames().size(), triggerLessonId);

        return CheckOffer.minted(exam.getExamId(), chosen.size(), candidates.lessonNames());
    }

    /**
     * Picks the five, mistakes first.
     *
     * <h3>Why mistakes rather than a random spread</h3>
     * A random five from everything the learner has finished mostly re-asks
     * what they already know, which is a pleasant interruption that teaches
     * nothing. The questions worth stopping someone mid-lesson for are the ones
     * they have already got wrong -- that is the gap the check exists to close.
     *
     * <p>Every submitted assessment counts as evidence, not just lesson
     * quizzes: a question missed on a mock exam is the same gap as one missed
     * on a quiz. Ordered worst-first by {@code missedQuestionIds} -- a question
     * missed four times outranks one missed once.
     *
     * <p>The bank fills whatever the mistakes leave. A learner with no history
     * yet, or one who has fixed everything they got wrong, still gets a check;
     * it is simply a spot-check across finished material rather than a
     * targeted one. Those filler questions are shuffled so the same learner
     * does not meet the same five in the same order.
     */
    private List<Long> selectQuestions(Long learnerId, Candidates candidates) {
        // Only questions this check could legitimately serve: from lessons the
        // learner has finished, never the lesson on screen. Intersecting the
        // mistake list with this set applies both rules for free.
        Set<Long> eligible = new LinkedHashSet<>(candidates.questionIds());

        List<Long> chosen = new ArrayList<>();

        // Tier 1: previously missed, worst first.
        for (Long missed : history.missedQuestionIds(learnerId, null, null)) {
            if (chosen.size() >= CHECK_SIZE) break;
            if (eligible.contains(missed) && !chosen.contains(missed)) {
                chosen.add(missed);
            }
        }

        // Tier 2: the bank, for whatever is left.
        if (chosen.size() < CHECK_SIZE) {
            List<Long> filler = new ArrayList<>(eligible);
            filler.removeAll(chosen);
            Collections.shuffle(filler, ThreadLocalRandom.current());
            for (Long candidate : filler) {
                if (chosen.size() >= CHECK_SIZE) break;
                chosen.add(candidate);
            }
        }

        return List.copyOf(chosen);
    }

    private boolean onCooldown(Long learnerId) {
        LocalDateTime lastServed = exams.findLastServedAt(learnerId, KNOWLEDGE_CHECK_EXAM_TYPE);
        return lastServed != null && lastServed.isAfter(LocalDateTime.now().minus(COOLDOWN));
    }

    private Lesson requireLesson(Long lessonId) {
        return lessons.findById(lessonId)
                .orElseThrow(() -> new EntityNotFoundException("Lesson not found: " + lessonId));
    }

    private static Certification certificationOf(Lesson lesson) {
        return lesson.getMiddleCategory().getMajorCategory().getCertification();
    }

    /**
     * Official questions from lessons this learner has finished, minus the
     * lesson they are reading now.
     *
     * <h3>Why it does not stop at the current certification</h3>
     * Preferring the certification being read is right -- recall lands best on
     * material adjacent to what is in front of you. Requiring it is not, and on
     * a curriculum where a certification holds only a handful of lessons it is
     * fatal: with one lesson per certification, the only in-scope lesson is the
     * one being read, which is excluded, so the pool is empty and no check can
     * ever fire. That is not a hypothetical -- it is exactly the shape of this
     * database today.
     *
     * <p>So same-certification lessons are gathered first and everything else
     * the learner has finished follows. With enough nearby material the tail is
     * never reached; without it, the learner still gets a check drawn from
     * something they genuinely finished, which is the point of the feature. The
     * modal names the source lessons either way, so a question from another
     * certification arrives labelled rather than baffling.
     */
    private Candidates candidateQuestions(Long learnerId, Lesson trigger) {
        Long certificationId = certificationOf(trigger).getCertificationId();

        List<LearnerCompletedLesson> sameCertification = completedLessons
                .findByLearner_LearnerIdAndLesson_MiddleCategory_MajorCategory_Certification_CertificationId(
                        learnerId, certificationId);

        // Ordered: the certification being read first, then the rest. The
        // LinkedHashMap below de-duplicates, so the overlap between these two
        // lists costs nothing but keeps the preference intact.
        List<LearnerCompletedLesson> done = new ArrayList<>(sameCertification);
        done.addAll(completedLessons.findByLearner_LearnerId(learnerId));

        // LinkedHashMap so the names read back in a stable order, and so a
        // lesson contributing many questions is still named only once.
        Map<Long, String> sourceLessons = new LinkedHashMap<>();
        List<Long> questionIds = new ArrayList<>();

        for (LearnerCompletedLesson completed : done) {
            Lesson lesson = completed.getLesson();
            if (lesson == null || lesson.getLessonId().equals(trigger.getLessonId())) {
                continue;
            }
            if (sourceLessons.containsKey(lesson.getLessonId())) {
                continue; // already gathered from the same-certification pass
            }

            List<Long> fromLesson = eligibleQuestions
                    .resolveScopeViews(null, null, null, lesson.getLessonId()).stream()
                    // Another institution group's private questions are never
                    // eligible here: the check is assembled for the learner,
                    // with no group context to check them against. The same
                    // rule the recall session applies.
                    .filter(view -> view.getOwnerGroupId() == null)
                    .map(QuestionSelectionView::getQuestionId)
                    .toList();

            if (fromLesson.isEmpty()) {
                continue;
            }

            questionIds.addAll(fromLesson);
            sourceLessons.put(lesson.getLessonId(), lesson.getName());
        }

        return new Candidates(questionIds, List.copyOf(sourceLessons.values()));
    }

    private record Candidates(List<Long> questionIds, List<String> lessonNames) {}
}

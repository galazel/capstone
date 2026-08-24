package com.capstone.rebyu.assessment.service;

import com.capstone.rebyu.assessment.config.RetakeProperties;
import com.capstone.rebyu.assessment.entity.AssessmentAttempt;
import com.capstone.rebyu.assessment.entity.AssessmentAttemptAnswer;
import com.capstone.rebyu.assessment.entity.AssessmentAttemptQuestion;
import com.capstone.rebyu.assessment.entity.Exam;
import com.capstone.rebyu.assessment.entity.ExamQuestion;
import com.capstone.rebyu.assessment.entity.Question;
import com.capstone.rebyu.assessment.repository.AssessmentAttemptAnswerRepository;
import com.capstone.rebyu.assessment.repository.AssessmentAttemptQuestionRepository;
import com.capstone.rebyu.assessment.repository.AssessmentAttemptRepository;
import com.capstone.rebyu.assessment.repository.QuestionRepository;
import com.capstone.rebyu.assessment.repository.QuestionSelectionView;
import com.capstone.rebyu.bkt.service.BktEventFactory;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Assembles a retake's question set from the learner's own past-attempt
 * history, weighting toward the lesson/difficulty tiers they're weakest in --
 * pure application logic and database queries, no AI/external service call.
 *
 * <p>Algorithm:
 * <ol>
 *   <li>Build a weakness matrix: accuracy per (lesson, difficulty) cell from
 *       every past graded attempt of this exam.</li>
 *   <li>Take the exam's current fixed question list as the baseline mix.</li>
 *   <li>Boost a cell's share of the new question set when its accuracy is
 *       below {@link RetakeProperties#getWeakAccuracyThreshold()}; reduce it
 *       when above {@link RetakeProperties#getStrongAccuracyThreshold()}.</li>
 *   <li>Fill each cell preferring questions the learner hasn't seen yet in
 *       this exam; fall back to seen questions, then to an easier adjacent
 *       tier in the same lesson, then to the original baseline questions --
 *       so the target question count is always met.</li>
 * </ol>
 *
 * <p>Every step above runs on {@link QuestionSelectionView} projections rather
 * than {@code Question} entities, and only the questions actually chosen are
 * loaded whole at the end. That is not a micro-optimization: a {@code Question}
 * entity drags three eagerly-fetched one-to-one configs behind it, so sifting a
 * certification's bank as entities cost three extra round trips per candidate
 * to end up using a few dozen of them.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdaptiveRetakeQuestionSelectionService {

    private static final List<String> DIFFICULTY_ORDER = List.of("EASY", "AVERAGE", "HARD");

    private final AssessmentAttemptRepository attemptRepository;
    private final AssessmentAttemptQuestionRepository attemptQuestionRepository;
    private final AssessmentAttemptAnswerRepository attemptAnswerRepository;
    private final QuestionRepository questionRepository;
    private final EligibleQuestionService eligibleQuestionService;
    private final BktEventFactory bktEventFactory;
    private final RetakeProperties properties;
    private final ObjectMapper objectMapper;

    private record Cell(Long lessonId, String difficulty) {}

    private record CellStat(int correct, int total) {
        double accuracy() {
            return total == 0 ? 1.0 : (double) correct / total;
        }
    }

    public record Selection(List<Question> questions, String retakeBasisJson) {}

    /**
     * @param baselineExamQuestions the exam's current fixed question list --
     *                              used as the target distribution's baseline
     *                              mix and as the last-resort fallback source.
     */
    @Transactional(readOnly = true)
    public Selection select(Exam exam, Long learnerId, List<ExamQuestion> baselineExamQuestions) {
        /* Reading only the id off each ExamQuestion's question keeps the lazy
           proxies uninitialized -- the whole point of selecting on projections
           is undone the moment something dereferences these entities. */
        List<Long> baselineQuestionIds = baselineExamQuestions.stream()
                .map(examQuestion -> examQuestion.getQuestion().getQuestionId())
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        int targetTotal = exam.getTotalQuestions() != null
                ? exam.getTotalQuestions()
                : baselineQuestionIds.size();

        if (!properties.isEnabled()) {
            return new Selection(loadInOrder(baselineQuestionIds), null);
        }

        List<AssessmentAttempt> pastAttempts = attemptRepository.findByExam_ExamIdAndLearnerIdAndStatus(
                exam.getExamId(), learnerId, AssessmentAttempt.Status.SUBMITTED);
        if (pastAttempts.isEmpty()) {
            // Nothing to adapt from yet (shouldn't normally happen for a
            // retake, but never block the attempt on it).
            return new Selection(loadInOrder(baselineQuestionIds), null);
        }

        List<Long> pastAttemptIds = pastAttempts.stream()
                .map(AssessmentAttempt::getAssessmentAttemptId)
                .toList();
        List<AssessmentAttemptQuestion> pastAttemptQuestions =
                attemptQuestionRepository.findByAttempt_AssessmentAttemptIdIn(pastAttemptIds);
        List<AssessmentAttemptAnswer> pastAnswers =
                attemptAnswerRepository.findByAttempt_AssessmentAttemptIdIn(pastAttemptIds);
        Map<Long, AssessmentAttemptAnswer> answerByAttemptQuestionId = pastAnswers.stream()
                .collect(Collectors.toMap(a -> a.getAttemptQuestion().getAttemptQuestionId(), a -> a));

        Set<Long> seenQuestionIds = pastAttemptQuestions.stream()
                .map(AssessmentAttemptQuestion::getSourceQuestionId)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        /* The questions the learner saw on their most recent attempt.
           "Seen at some point" and "seen ten minutes ago" are very different
           things to a retake: the second is the set the learner still
           remembers. These are avoided ahead of everything else and only used
           when the alternatives run out, which is what keeps a retake from
           re-showing the paper that was just submitted while still guaranteeing
           the target question count. */
        Long latestAttemptId = pastAttempts.stream()
                .filter(attempt -> attempt.getSubmittedAt() != null)
                .max(Comparator.comparing(AssessmentAttempt::getSubmittedAt))
                .map(AssessmentAttempt::getAssessmentAttemptId)
                .orElse(null);
        Set<Long> previousAttemptQuestionIds = latestAttemptId == null
                ? Set.of()
                : pastAttemptQuestions.stream()
                        .filter(aq -> latestAttemptId.equals(
                                aq.getAttempt().getAssessmentAttemptId()))
                        .map(AssessmentAttemptQuestion::getSourceQuestionId)
                        .collect(Collectors.toSet());

        Map<Long, QuestionSelectionView> pastSourceQuestionsById = seenQuestionIds.isEmpty()
                ? Map.of()
                : questionRepository.findSelectionViewsByIdIn(seenQuestionIds).stream()
                        .collect(Collectors.toMap(QuestionSelectionView::getQuestionId, v -> v));

        // --- 1. Weakness matrix: accuracy per (lesson, difficulty) --------
        Map<Cell, int[]> tally = new LinkedHashMap<>(); // [correct, total]
        for (AssessmentAttemptQuestion attemptQuestion : pastAttemptQuestions) {
            AssessmentAttemptAnswer answer = answerByAttemptQuestionId.get(attemptQuestion.getAttemptQuestionId());
            if (answer == null || answer.isPendingManualEvaluation() || answer.getIsCorrect() == null) {
                continue; // unanswered / pending grading -- not usable evidence
            }
            QuestionSelectionView sourceQuestion = pastSourceQuestionsById.get(attemptQuestion.getSourceQuestionId());
            String difficulty = bktEventFactory.normalizeDifficulty(
                    sourceQuestion == null ? null : sourceQuestion.getDifficultyLevel());
            Cell cell = new Cell(attemptQuestion.getLessonId(), difficulty);
            int[] counts = tally.computeIfAbsent(cell, c -> new int[2]);
            counts[1]++;
            if (Boolean.TRUE.equals(answer.getIsCorrect())) {
                counts[0]++;
            }
        }
        Map<Cell, CellStat> weakness = tally.entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, e -> new CellStat(e.getValue()[0], e.getValue()[1])));

        // --- 2. Baseline distribution from the exam's current fixed mix ---
        List<QuestionSelectionView> baselineQuestions = baselineQuestionIds.isEmpty()
                ? List.of()
                : orderViewsBy(baselineQuestionIds,
                        questionRepository.findSelectionViewsByIdIn(baselineQuestionIds));

        Map<Cell, Integer> baselineCounts = new LinkedHashMap<>();
        for (QuestionSelectionView question : baselineQuestions) {
            Cell cell = new Cell(
                    question.getLessonId(),
                    bktEventFactory.normalizeDifficulty(question.getDifficultyLevel()));
            baselineCounts.merge(cell, 1, Integer::sum);
        }
        if (baselineCounts.isEmpty()) {
            return new Selection(loadInOrder(baselineQuestionIds), null);
        }

        // --- 3. Target distribution: boost weak cells, reduce strong ones -
        Map<Cell, Double> adjustedShares = new LinkedHashMap<>();
        for (Map.Entry<Cell, Integer> entry : baselineCounts.entrySet()) {
            double baselineShare = (double) entry.getValue() / baselineQuestions.size();
            CellStat stat = weakness.get(entry.getKey());
            double share = baselineShare;
            if (stat != null && stat.total() >= properties.getMinEvidencePerCell()) {
                if (stat.accuracy() < properties.getWeakAccuracyThreshold()) {
                    share = baselineShare * properties.getWeakBoostFactor();
                } else if (stat.accuracy() > properties.getStrongAccuracyThreshold()) {
                    share = baselineShare * properties.getStrongReductionFactor();
                }
            }
            adjustedShares.put(entry.getKey(), share);
        }

        /* Move share between difficulty tiers, per lesson.
           Scaling each cell on its own accuracy can only make a lesson bigger
           or smaller; it can never change the *shape* of that lesson's
           difficulty mix. So a learner failing every Hard question kept being
           handed the same number of Hard questions, just more of them overall.

           Poor at Hard in this lesson -> part of Hard's share moves down into
           Average and Easy, rebuilding the foundation. Strong at Easy and
           Average -> part of their share moves up into Hard. Per lesson, and
           only where there is evidence, so ability is never assumed to be
           uniform across topics. */
        applyDifficultyMigration(adjustedShares, weakness);
        double shareTotal = adjustedShares.values().stream().mapToDouble(Double::doubleValue).sum();
        if (shareTotal <= 0) {
            return new Selection(loadInOrder(baselineQuestionIds), null);
        }

        Map<Cell, Integer> targetCounts = new LinkedHashMap<>();
        int assigned = 0;
        Cell largestCell = null;
        int largestCount = -1;
        for (Map.Entry<Cell, Double> entry : adjustedShares.entrySet()) {
            int count = (int) Math.round(entry.getValue() / shareTotal * targetTotal);
            targetCounts.put(entry.getKey(), count);
            assigned += count;
            if (count > largestCount) {
                largestCount = count;
                largestCell = entry.getKey();
            }
        }
        // Reconcile rounding drift against the exam's exact question count.
        if (largestCell != null && assigned != targetTotal) {
            targetCounts.merge(largestCell, targetTotal - assigned, Integer::sum);
        }

        // --- 4. Candidate pool for the exam's whole curriculum scope -------
        Long ownerGroupId = exam.getOwnerGroup() != null ? exam.getOwnerGroup().getEnterpriseGroupId() : null;
        List<QuestionSelectionView> candidatePool = eligibleQuestionService.resolveScopeViews(
                exam.getCertification() != null ? exam.getCertification().getCertificationId() : null,
                exam.getMajorCategory() != null ? exam.getMajorCategory().getMajorCategoryId() : null,
                exam.getMiddleCategory() != null ? exam.getMiddleCategory().getMiddleCategoryId() : null,
                exam.getLesson() != null ? exam.getLesson().getLessonId() : null);
        candidatePool = candidatePool.stream()
                .filter(q -> q.getOwnerGroupId() == null
                        || Objects.equals(q.getOwnerGroupId(), ownerGroupId))
                .toList();

        Map<Cell, List<QuestionSelectionView>> poolByCell = candidatePool.stream()
                .collect(Collectors.groupingBy(q -> new Cell(
                        q.getLessonId(),
                        bktEventFactory.normalizeDifficulty(q.getDifficultyLevel())),
                        LinkedHashMap::new, Collectors.toList()));
        // Randomize each cell's candidate order so repeated retakes don't
        // always draw the same "first N" questions from a lesson's pool.
        for (List<QuestionSelectionView> pool : poolByCell.values()) {
            Collections.shuffle(pool);
        }

        // --- 5. Fill each cell: unseen, then older, then last attempt -----
        Picked picked = new Picked();
        for (Map.Entry<Cell, Integer> entry : targetCounts.entrySet()) {
            fillCell(entry.getKey(), entry.getValue(), poolByCell, seenQuestionIds,
                    previousAttemptQuestionIds, picked);
        }

        // --- 6. Last resort: top up from the exam's own baseline questions -
        if (picked.size() < targetTotal) {
            for (QuestionSelectionView question : baselineQuestions) {
                if (picked.size() >= targetTotal) break;
                picked.add(question);
            }
        }
        List<QuestionSelectionView> selected = picked.questions();
        if (selected.size() > targetTotal) {
            selected = selected.subList(0, targetTotal);
        }

        // Every retake shuffles final question order, regardless of how the
        // set itself was assembled.
        Collections.shuffle(selected);

        String basisJson = buildRetakeBasisJson(weakness, baselineCounts, targetCounts);
        log.info("Adaptive retake selection for exam {} learner {}: {} questions ({} unseen)",
                exam.getExamId(), learnerId, selected.size(),
                selected.stream().filter(q -> !seenQuestionIds.contains(q.getQuestionId())).count());

        // Only now, for the paper's worth of questions that survived, is the
        // full entity (choices and type configs included) worth fetching.
        List<Long> selectedIds = selected.stream().map(QuestionSelectionView::getQuestionId).toList();
        return new Selection(loadInOrder(selectedIds), basisJson);
    }

    /**
     * Loads whole questions for the given ids, in the order given.
     *
     * <p>The order is the paper's order, so it cannot be left to the database:
     * an {@code IN} query returns rows however it likes, and the retake's
     * shuffle would be silently replaced by primary-key order.
     */
    private List<Question> loadInOrder(List<Long> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<Long, Question> byId = questionRepository.findForAttemptByIdIn(ids).stream()
                .collect(Collectors.toMap(Question::getQuestionId, q -> q, (a, b) -> a));
        List<Question> ordered = new ArrayList<>(ids.size());
        for (Long id : ids) {
            Question question = byId.get(id);
            if (question != null) {
                ordered.add(question);
            }
        }
        return ordered;
    }

    /** Same ordering guarantee as {@link #loadInOrder}, for projections. */
    private List<QuestionSelectionView> orderViewsBy(
            List<Long> ids, Collection<QuestionSelectionView> views) {
        Map<Long, QuestionSelectionView> byId = views.stream()
                .collect(Collectors.toMap(QuestionSelectionView::getQuestionId, v -> v, (a, b) -> a));
        List<QuestionSelectionView> ordered = new ArrayList<>(ids.size());
        for (Long id : ids) {
            QuestionSelectionView view = byId.get(id);
            if (view != null) {
                ordered.add(view);
            }
        }
        return ordered;
    }

    /**
     * The questions chosen so far, and both things that make another one a repeat.
     *
     * The id set alone was not enough. The question bank holds the same question
     * under more than one id — a lesson regenerated adds a second copy of what
     * is already there rather than recognising it — so two ids can carry one
     * question, and a paper drawing both showed the learner the same question
     * twice. Deduplicating on the text as well means the selector cannot serve
     * a repeat however the bank got into that state.
     */
    private static final class Picked {
        private final List<QuestionSelectionView> questions = new ArrayList<>();
        private final Set<Long> ids = new LinkedHashSet<>();
        private final Set<String> stems = new HashSet<>();

        /** @return false when this question (or its twin) is already picked. */
        boolean add(QuestionSelectionView question) {
            Long id = question.getQuestionId();
            String stem = stemOf(question);
            if ((id != null && ids.contains(id)) || (!stem.isEmpty() && stems.contains(stem))) {
                return false;
            }
            if (id != null) {
                ids.add(id);
            }
            if (!stem.isEmpty()) {
                stems.add(stem);
            }
            questions.add(question);
            return true;
        }

        boolean contains(QuestionSelectionView question) {
            Long id = question.getQuestionId();
            String stem = stemOf(question);
            return (id != null && ids.contains(id)) || (!stem.isEmpty() && stems.contains(stem));
        }

        int size() {
            return questions.size();
        }

        List<QuestionSelectionView> questions() {
            return new ArrayList<>(questions);
        }
    }

    /**
     * A question's text reduced to what makes it the same question.
     *
     * Case and punctuation only — deliberately not fuzzy. Near-duplicate
     * detection already exists for the admin reviewing generated questions,
     * and guessing at similarity here would silently drop a question a learner
     * was meant to be asked. This catches the copies that are genuinely
     * identical, which is what the bank actually contains.
     */
    private static String stemOf(QuestionSelectionView question) {
        String text = question.getQuestionText();
        if (text == null) {
            return "";
        }
        StringBuilder cleaned = new StringBuilder(text.length());
        for (char character : text.toLowerCase().toCharArray()) {
            if (Character.isLetterOrDigit(character)) {
                cleaned.append(character);
            } else if (Character.isWhitespace(character)) {
                cleaned.append(' ');
            }
        }
        return String.join(" ", cleaned.toString().trim().split("\\s+"));
    }

    /** Preference order when drawing from a cell, best first. */
    private enum Tier {
        /** Never shown to this learner on this exam. */
        UNSEEN,
        /** Seen before, but not on the attempt they just submitted. */
        OLDER,
        /** On the previous attempt -- a last resort, so the count is still met. */
        PREVIOUS
    }

    private void fillCell(
            Cell cell, int count, Map<Cell, List<QuestionSelectionView>> poolByCell, Set<Long> seenQuestionIds,
            Set<Long> previousAttemptQuestionIds, Picked picked) {
        if (count <= 0) {
            return;
        }
        int remaining = count;
        for (Tier tier : Tier.values()) {
            if (remaining <= 0) break;
            remaining -= takeFromCell(cell, remaining, poolByCell, seenQuestionIds,
                    previousAttemptQuestionIds, picked, tier);
        }
        // Scaffold: fall back to progressively easier tiers in the same
        // lesson, then progressively harder ones, before giving up on this
        // cell (the baseline top-up in select() covers any final shortfall).
        int difficultyIndex = DIFFICULTY_ORDER.indexOf(cell.difficulty());
        for (int step = 1; remaining > 0 && step < DIFFICULTY_ORDER.size(); step++) {
            int easierIndex = difficultyIndex - step;
            if (easierIndex >= 0) {
                Cell easier = new Cell(cell.lessonId(), DIFFICULTY_ORDER.get(easierIndex));
                for (Tier tier : Tier.values()) {
                    if (remaining <= 0) break;
                    remaining -= takeFromCell(easier, remaining, poolByCell, seenQuestionIds,
                            previousAttemptQuestionIds, picked, tier);
                }
            }
            int harderIndex = difficultyIndex + step;
            if (remaining > 0 && harderIndex < DIFFICULTY_ORDER.size()) {
                Cell harder = new Cell(cell.lessonId(), DIFFICULTY_ORDER.get(harderIndex));
                for (Tier tier : Tier.values()) {
                    if (remaining <= 0) break;
                    remaining -= takeFromCell(harder, remaining, poolByCell, seenQuestionIds,
                            previousAttemptQuestionIds, picked, tier);
                }
            }
        }
    }

    /** @return how many questions were actually taken. */
    private int takeFromCell(
            Cell cell, int need, Map<Cell, List<QuestionSelectionView>> poolByCell, Set<Long> seenQuestionIds,
            Set<Long> previousAttemptQuestionIds, Picked picked, Tier tier) {
        if (need <= 0) {
            return 0;
        }
        List<QuestionSelectionView> pool = poolByCell.get(cell);
        if (pool == null) {
            return 0;
        }
        int taken = 0;
        for (QuestionSelectionView question : pool) {
            if (taken >= need) break;
            Long questionId = question.getQuestionId();
            // Skips a question already picked *or* one whose text is already on
            // the paper under a different id.
            if (picked.contains(question)) continue;

            boolean onPrevious = previousAttemptQuestionIds.contains(questionId);
            boolean seen = seenQuestionIds.contains(questionId);
            boolean matchesTier = switch (tier) {
                case UNSEEN -> !seen;
                case OLDER -> seen && !onPrevious;
                case PREVIOUS -> onPrevious;
            };
            if (!matchesTier) continue;

            if (!picked.add(question)) continue;
            taken++;
        }
        return taken;
    }

    /**
     * Shifts share between difficulty tiers within each lesson.
     *
     * Only tiers with enough evidence move, and the share is conserved -- what
     * Hard gives up is exactly what Average and Easy receive -- so this changes
     * the shape of a lesson's question mix without changing how much of the
     * paper that lesson occupies. That is deliberate: how much a lesson is
     * worth is decided by the weak/strong boost above, and this decides what
     * kind of questions fill it.
     */
    private void applyDifficultyMigration(
            Map<Cell, Double> shares, Map<Cell, CellStat> weakness) {

        Set<Long> lessonIds = shares.keySet().stream()
                .map(Cell::lessonId)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        for (Long lessonId : lessonIds) {
            Cell easy = new Cell(lessonId, "EASY");
            Cell average = new Cell(lessonId, "AVERAGE");
            Cell hard = new Cell(lessonId, "HARD");

            CellStat hardStat = weakness.get(hard);
            double factor = properties.getDifficultyMigrationFactor();

            // Struggling with Hard here: rebuild the foundation instead.
            if (hardStat != null
                    && hardStat.total() >= properties.getMinEvidencePerCell()
                    && hardStat.accuracy() < properties.getWeakAccuracyThreshold()) {
                double hardShare = shares.getOrDefault(hard, 0.0);
                double moved = hardShare * factor;
                if (moved > 0) {
                    shares.put(hard, hardShare - moved);
                    // Split toward Average first -- it is the nearer step down,
                    // and dropping straight to Easy would under-serve a learner
                    // who is merely short of Hard rather than lost.
                    shares.merge(average, moved * 0.6, Double::sum);
                    shares.merge(easy, moved * 0.4, Double::sum);
                }
                continue; // never promote and demote the same lesson at once
            }

            // Comfortable at the lower tiers: start stretching them.
            CellStat easyStat = weakness.get(easy);
            CellStat averageStat = weakness.get(average);
            int lowerTotal = (easyStat == null ? 0 : easyStat.total())
                    + (averageStat == null ? 0 : averageStat.total());
            int lowerCorrect = (easyStat == null ? 0 : easyStat.correct())
                    + (averageStat == null ? 0 : averageStat.correct());

            if (lowerTotal >= properties.getMinEvidencePerCell()
                    && (double) lowerCorrect / lowerTotal > properties.getStrongAccuracyThreshold()) {
                double easyShare = shares.getOrDefault(easy, 0.0);
                double moved = easyShare * factor;
                if (moved > 0) {
                    shares.put(easy, easyShare - moved);
                    shares.merge(hard, moved, Double::sum);
                }
            }
        }
    }

    private String buildRetakeBasisJson(
            Map<Cell, CellStat> weakness, Map<Cell, Integer> baselineCounts, Map<Cell, Integer> targetCounts) {
        try {
            List<Map<String, Object>> cells = new ArrayList<>();
            for (Cell cell : targetCounts.keySet()) {
                CellStat stat = weakness.get(cell);
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("lessonId", cell.lessonId());
                row.put("difficulty", cell.difficulty());
                row.put("pastCorrect", stat != null ? stat.correct() : null);
                row.put("pastTotal", stat != null ? stat.total() : null);
                row.put("pastAccuracy", stat != null ? stat.accuracy() : null);
                row.put("baselineCount", baselineCounts.getOrDefault(cell, 0));
                row.put("targetCount", targetCounts.get(cell));
                cells.add(row);
            }
            return objectMapper.writeValueAsString(Map.of("cells", cells));
        } catch (Exception e) {
            log.warn("Could not serialize retake basis: {}", e.getMessage());
            return null;
        }
    }
}

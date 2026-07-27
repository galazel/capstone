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
import com.capstone.rebyu.bkt.service.BktEventFactory;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
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
        List<Question> baselineQuestions = baselineExamQuestions.stream()
                .map(ExamQuestion::getQuestion)
                .toList();
        int targetTotal = exam.getTotalQuestions() != null
                ? exam.getTotalQuestions()
                : baselineQuestions.size();

        if (!properties.isEnabled()) {
            return new Selection(baselineQuestions, null);
        }

        List<AssessmentAttempt> pastAttempts = attemptRepository.findByExam_ExamIdAndLearnerIdAndStatus(
                exam.getExamId(), learnerId, AssessmentAttempt.Status.SUBMITTED);
        if (pastAttempts.isEmpty()) {
            // Nothing to adapt from yet (shouldn't normally happen for a
            // retake, but never block the attempt on it).
            return new Selection(baselineQuestions, null);
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

        Map<Long, Question> pastSourceQuestionsById = seenQuestionIds.isEmpty()
                ? Map.of()
                : questionRepository.findAllById(seenQuestionIds).stream()
                        .collect(Collectors.toMap(Question::getQuestionId, q -> q));

        // --- 1. Weakness matrix: accuracy per (lesson, difficulty) --------
        Map<Cell, int[]> tally = new LinkedHashMap<>(); // [correct, total]
        for (AssessmentAttemptQuestion attemptQuestion : pastAttemptQuestions) {
            AssessmentAttemptAnswer answer = answerByAttemptQuestionId.get(attemptQuestion.getAttemptQuestionId());
            if (answer == null || answer.isPendingManualEvaluation() || answer.getIsCorrect() == null) {
                continue; // unanswered / pending grading -- not usable evidence
            }
            Question sourceQuestion = pastSourceQuestionsById.get(attemptQuestion.getSourceQuestionId());
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
        Map<Cell, Integer> baselineCounts = new LinkedHashMap<>();
        for (Question question : baselineQuestions) {
            Cell cell = new Cell(
                    question.getLesson().getLessonId(),
                    bktEventFactory.normalizeDifficulty(question.getDifficultyLevel()));
            baselineCounts.merge(cell, 1, Integer::sum);
        }
        if (baselineCounts.isEmpty()) {
            return new Selection(baselineQuestions, null);
        }

        // --- 3. Target distribution: boost weak cells, reduce strong ones -
        Map<Cell, Double> adjustedShares = new LinkedHashMap<>();
        double shareTotal = 0.0;
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
            shareTotal += share;
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
        List<Question> candidatePool = eligibleQuestionService.resolveScope(
                exam.getCertification() != null ? exam.getCertification().getCertificationId() : null,
                exam.getMajorCategory() != null ? exam.getMajorCategory().getMajorCategoryId() : null,
                exam.getMiddleCategory() != null ? exam.getMiddleCategory().getMiddleCategoryId() : null,
                exam.getLesson() != null ? exam.getLesson().getLessonId() : null);
        Long ownerGroupId = exam.getOwnerGroup() != null ? exam.getOwnerGroup().getEnterpriseGroupId() : null;
        candidatePool = candidatePool.stream()
                .filter(q -> q.getOwnerGroup() == null
                        || Objects.equals(q.getOwnerGroup().getEnterpriseGroupId(), ownerGroupId))
                .toList();

        Map<Cell, List<Question>> poolByCell = candidatePool.stream()
                .collect(Collectors.groupingBy(q -> new Cell(
                        q.getLesson().getLessonId(),
                        bktEventFactory.normalizeDifficulty(q.getDifficultyLevel())),
                        LinkedHashMap::new, Collectors.toList()));
        // Randomize each cell's candidate order so repeated retakes don't
        // always draw the same "first N" questions from a lesson's pool.
        for (List<Question> pool : poolByCell.values()) {
            Collections.shuffle(pool);
        }

        // --- 5. Fill each cell: unseen first, then seen, then scaffold -----
        List<Question> selected = new ArrayList<>();
        Set<Long> usedQuestionIds = new LinkedHashSet<>();
        for (Map.Entry<Cell, Integer> entry : targetCounts.entrySet()) {
            fillCell(entry.getKey(), entry.getValue(), poolByCell, seenQuestionIds, usedQuestionIds, selected);
        }

        // --- 6. Last resort: top up from the exam's own baseline questions -
        if (selected.size() < targetTotal) {
            for (Question question : baselineQuestions) {
                if (selected.size() >= targetTotal) break;
                if (usedQuestionIds.add(question.getQuestionId())) {
                    selected.add(question);
                }
            }
        }
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
        return new Selection(selected, basisJson);
    }

    private void fillCell(
            Cell cell, int count, Map<Cell, List<Question>> poolByCell, Set<Long> seenQuestionIds,
            Set<Long> usedQuestionIds, List<Question> selected) {
        if (count <= 0) {
            return;
        }
        int remaining = count;
        remaining -= takeFromCell(cell, remaining, poolByCell, seenQuestionIds, usedQuestionIds, selected, true);
        if (remaining > 0) {
            remaining -= takeFromCell(cell, remaining, poolByCell, seenQuestionIds, usedQuestionIds, selected, false);
        }
        // Scaffold: fall back to progressively easier tiers in the same
        // lesson, then progressively harder ones, before giving up on this
        // cell (the baseline top-up in select() covers any final shortfall).
        int difficultyIndex = DIFFICULTY_ORDER.indexOf(cell.difficulty());
        for (int step = 1; remaining > 0 && step < DIFFICULTY_ORDER.size(); step++) {
            int easierIndex = difficultyIndex - step;
            if (easierIndex >= 0) {
                Cell easier = new Cell(cell.lessonId(), DIFFICULTY_ORDER.get(easierIndex));
                remaining -= takeFromCell(easier, remaining, poolByCell, seenQuestionIds, usedQuestionIds, selected, true);
                remaining -= takeFromCell(easier, remaining, poolByCell, seenQuestionIds, usedQuestionIds, selected, false);
            }
            int harderIndex = difficultyIndex + step;
            if (remaining > 0 && harderIndex < DIFFICULTY_ORDER.size()) {
                Cell harder = new Cell(cell.lessonId(), DIFFICULTY_ORDER.get(harderIndex));
                remaining -= takeFromCell(harder, remaining, poolByCell, seenQuestionIds, usedQuestionIds, selected, true);
                remaining -= takeFromCell(harder, remaining, poolByCell, seenQuestionIds, usedQuestionIds, selected, false);
            }
        }
    }

    /** @return how many questions were actually taken. */
    private int takeFromCell(
            Cell cell, int need, Map<Cell, List<Question>> poolByCell, Set<Long> seenQuestionIds,
            Set<Long> usedQuestionIds, List<Question> selected, boolean unseenOnly) {
        if (need <= 0) {
            return 0;
        }
        List<Question> pool = poolByCell.get(cell);
        if (pool == null) {
            return 0;
        }
        int taken = 0;
        for (Question question : pool) {
            if (taken >= need) break;
            if (usedQuestionIds.contains(question.getQuestionId())) continue;
            boolean seen = seenQuestionIds.contains(question.getQuestionId());
            if (unseenOnly && seen) continue;
            usedQuestionIds.add(question.getQuestionId());
            selected.add(question);
            taken++;
        }
        return taken;
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

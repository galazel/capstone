package com.capstone.rebyu.learningtools.service;

import com.capstone.rebyu.bkt.config.BktProperties;
import com.capstone.rebyu.bkt.dto.BktMasteryEvent;
import com.capstone.rebyu.bkt.service.BktEventFactory;
import com.capstone.rebyu.bkt.service.BktOutboxService;
import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.certification.entity.MiddleCategory;
import com.capstone.rebyu.learningtools.entity.GeneratedStudySet;
import com.capstone.rebyu.learningtools.entity.LearnerPracticeAnswer;
import com.capstone.rebyu.learningtools.repository.GeneratedStudySetRepository;
import com.capstone.rebyu.learningtools.repository.LearnerPracticeAnswerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Converts only objective, lesson-linked quiz answers into the existing BKT
 * outbox contract, via the same {@link BktEventFactory}/{@link
 * BktOutboxService} the formal-assessment path uses -- so difficulty/
 * assessment-type normalization and outbox-row construction stay in one
 * place instead of being reimplemented here.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PracticeMasteryEvidenceService {
    private final GeneratedStudySetRepository studySets;
    private final LearnerPracticeAnswerRepository answers;
    private final BktEventFactory eventFactory;
    private final BktOutboxService outboxService;
    private final BktProperties properties;

    public boolean enqueueCompletedAttempt(Long learnerId, Long attemptId, String sourceType, Long sourceId) {
        if (!properties.isEnabled() || !("TUTOR_QUIZ".equals(sourceType) || "COMMUNITY_QUIZ".equals(sourceType))) {
            return false;
        }
        try {
            GeneratedStudySet set = studySets.findByIdWithCurriculum(sourceId).orElse(null);
            if (set == null) return false;
            Lesson lesson = set.getLesson();
            MiddleCategory middleCategory = lesson.getMiddleCategory();
            Long certificationId = set.getCertification().getCertificationId();

            List<LearnerPracticeAnswer> mcqAnswers = answers.findMcqAnsweredByAttempt(attemptId);
            int enqueued = 0;
            for (LearnerPracticeAnswer answer : mcqAnswers) {
                Long itemId = answer.getStudyItem().getStudyItemId();
                String eventId = "rebyu-practice:" + learnerId + ":" + sourceType + ":" + sourceId + ":" + itemId;

                BktMasteryEvent event = eventFactory.buildEvent(
                        eventId,
                        learnerId,
                        certificationId,
                        middleCategory.getMajorCategory().getMajorCategoryId(),
                        middleCategory.getMajorCategory().getTitle(),
                        middleCategory.getMiddleCategoryId(),
                        middleCategory.getTitle(),
                        lesson.getLessonId(),
                        lesson.getName(),
                        itemId,
                        Boolean.TRUE.equals(answer.getIsCorrect()),
                        answer.getStudyItem().getDifficulty(),
                        "LESSON_QUIZ");

                if (outboxService.enqueueEvent(event, "practice-" + attemptId, certificationId, attemptId)) {
                    enqueued++;
                }
            }
            return enqueued > 0;
        } catch (Exception e) {
            log.warn("Could not enqueue BKT evidence for practice attempt {}: {}", attemptId, e.getMessage());
            return false;
        }
    }
}

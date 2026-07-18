package com.capstone.rebyu.learningtools;

import com.capstone.rebyu.certification.repository.LessonRepository;
import com.capstone.rebyu.enrollment.repository.LearnerCertificationRepository;
import com.capstone.rebyu.gamification.RewardService;
import com.capstone.rebyu.learningtools.entity.GeneratedStudyItem;
import com.capstone.rebyu.learningtools.repository.GeneratedStudyItemRepository;
import com.capstone.rebyu.learningtools.repository.GeneratedStudySetRepository;
import com.capstone.rebyu.learningtools.repository.LearnerPracticeAnswerRepository;
import com.capstone.rebyu.learningtools.repository.LearnerPracticeAttemptRepository;
import com.capstone.rebyu.learningtools.entity.LearnerPracticeAttempt;
import com.capstone.rebyu.user.entity.Learner;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class StudyPracticeServiceTest {

    private static final Long LEARNER_ID = 1L;
    private static final Long ATTEMPT_ID = 10L;
    private static final Long ITEM_ID = 100L;
    private static final Long STUDY_SET_ID = 50L;

    private GeneratedStudySetRepository studySets;
    private GeneratedStudyItemRepository studyItems;
    private LearnerPracticeAttemptRepository attempts;
    private LearnerPracticeAnswerRepository answers;
    private LessonRepository lessons;
    private LearnerCertificationRepository enrollments;
    private RewardService rewards;
    private PracticeMasteryEvidenceService masteryEvidence;
    private StudyPracticeService service;

    @BeforeEach
    void setUp() {
        studySets = mock(GeneratedStudySetRepository.class);
        studyItems = mock(GeneratedStudyItemRepository.class);
        attempts = mock(LearnerPracticeAttemptRepository.class);
        answers = mock(LearnerPracticeAnswerRepository.class);
        lessons = mock(LessonRepository.class);
        enrollments = mock(LearnerCertificationRepository.class);
        rewards = mock(RewardService.class);
        masteryEvidence = mock(PracticeMasteryEvidenceService.class);
        service = new StudyPracticeService(studySets, studyItems, attempts, answers, lessons, enrollments,
                new ObjectMapper(), rewards, masteryEvidence);
    }

    private LearnerPracticeAttempt inProgressAttempt() {
        return LearnerPracticeAttempt.builder()
                .attemptId(ATTEMPT_ID)
                .learner(Learner.builder().learnerId(LEARNER_ID).build())
                .sourceType("TUTOR_QUIZ")
                .sourceId(STUDY_SET_ID)
                .status("IN_PROGRESS")
                .totalItems(2)
                .build();
    }

    private GeneratedStudyItem mcqItem() {
        return GeneratedStudyItem.builder()
                .studyItemId(ITEM_ID)
                .itemType("MCQ")
                .questionText("2+2?")
                .choicesJson("[{\"text\":\"4\",\"isCorrect\":true},{\"text\":\"5\",\"isCorrect\":false}]")
                .correctAnswer("4")
                .explanation("Basic addition")
                .displayOrder(1)
                .build();
    }

    // ---- submitAnswer ----

    @Test
    void submitAnswer_correctChoice_upsertsWithIsCorrectTrue() {
        when(attempts.findByAttemptIdAndLearner_LearnerId(ATTEMPT_ID, LEARNER_ID))
                .thenReturn(Optional.of(inProgressAttempt()));
        when(studyItems.findByStudyItemIdAndStudySet_StudySetId(ITEM_ID, STUDY_SET_ID))
                .thenReturn(Optional.of(mcqItem()));

        StudyPracticeService.AnswerResult result = service.submitAnswer(LEARNER_ID, ATTEMPT_ID, ITEM_ID, "4", null);

        assertTrue(result.correct());
        verify(answers).upsertAnswer(eq(ATTEMPT_ID), eq(ITEM_ID), eq("4"), anyString(), eq(true), eq(1), eq(null));
    }

    @Test
    void submitAnswer_resubmittingSameItem_callsUpsertAgainRatherThanInsertingSeparately() {
        when(attempts.findByAttemptIdAndLearner_LearnerId(ATTEMPT_ID, LEARNER_ID))
                .thenReturn(Optional.of(inProgressAttempt()));
        when(studyItems.findByStudyItemIdAndStudySet_StudySetId(ITEM_ID, STUDY_SET_ID))
                .thenReturn(Optional.of(mcqItem()));

        service.submitAnswer(LEARNER_ID, ATTEMPT_ID, ITEM_ID, "5", null);
        service.submitAnswer(LEARNER_ID, ATTEMPT_ID, ITEM_ID, "4", null);

        // Both submissions route through the same upsert repository method (ON CONFLICT DO UPDATE
        // in the underlying native query) -- re-answering never creates a second answer row.
        verify(answers, times(2)).upsertAnswer(eq(ATTEMPT_ID), eq(ITEM_ID), anyString(), anyString(), anyBoolean(), anyInt(), any());
    }

    @Test
    void submitAnswer_attemptNotInProgress_throws() {
        LearnerPracticeAttempt completed = inProgressAttempt();
        completed.setStatus("COMPLETED");
        when(attempts.findByAttemptIdAndLearner_LearnerId(ATTEMPT_ID, LEARNER_ID)).thenReturn(Optional.of(completed));

        assertThrows(IllegalArgumentException.class,
                () -> service.submitAnswer(LEARNER_ID, ATTEMPT_ID, ITEM_ID, "4", null));
    }

    @Test
    void submitAnswer_attemptNotFound_throwsEntityNotFound() {
        when(attempts.findByAttemptIdAndLearner_LearnerId(ATTEMPT_ID, LEARNER_ID)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class,
                () -> service.submitAnswer(LEARNER_ID, ATTEMPT_ID, ITEM_ID, "4", null));
    }

    // ---- completeAttempt ----

    @Test
    void completeAttempt_allCorrect_scoresFullMarksAndAwardsReward() {
        when(attempts.findByAttemptIdAndLearner_LearnerId(ATTEMPT_ID, LEARNER_ID))
                .thenReturn(Optional.of(inProgressAttempt()));
        when(answers.countByAttempt_AttemptId(ATTEMPT_ID)).thenReturn(2L);
        when(answers.countByAttempt_AttemptIdAndIsCorrectTrue(ATTEMPT_ID)).thenReturn(2L);
        when(rewards.awardCompletedPractice(eq(LEARNER_ID), eq(STUDY_SET_ID), eq("TUTOR_QUIZ"), eq(100.0)))
                .thenReturn(new RewardService.PracticeReward(15, 3, true));
        when(masteryEvidence.enqueueCompletedAttempt(any(), any(), any(), any())).thenReturn(true);

        StudyPracticeService.Completion result = service.completeAttempt(LEARNER_ID, ATTEMPT_ID);

        assertEquals(2, result.score());
        assertEquals(2, result.totalItems());
        assertEquals(100.0, result.percentage());
        assertEquals(15, result.xpEarned());
        assertEquals(3, result.coinEarned());
    }

    @Test
    void completeAttempt_halfCorrect_scoresFiftyPercent() {
        when(attempts.findByAttemptIdAndLearner_LearnerId(ATTEMPT_ID, LEARNER_ID))
                .thenReturn(Optional.of(inProgressAttempt()));
        when(answers.countByAttempt_AttemptId(ATTEMPT_ID)).thenReturn(2L);
        when(answers.countByAttempt_AttemptIdAndIsCorrectTrue(ATTEMPT_ID)).thenReturn(1L);
        when(rewards.awardCompletedPractice(eq(LEARNER_ID), eq(STUDY_SET_ID), eq("TUTOR_QUIZ"), eq(50.0)))
                .thenReturn(new RewardService.PracticeReward(7, 0, true));

        StudyPracticeService.Completion result = service.completeAttempt(LEARNER_ID, ATTEMPT_ID);

        assertEquals(1, result.score());
        assertEquals(50.0, result.percentage());
        assertEquals(7, result.xpEarned());
        assertEquals(0, result.coinEarned());
    }

    @Test
    void completeAttempt_notAllItemsAnswered_throws() {
        when(attempts.findByAttemptIdAndLearner_LearnerId(ATTEMPT_ID, LEARNER_ID))
                .thenReturn(Optional.of(inProgressAttempt()));
        when(answers.countByAttempt_AttemptId(ATTEMPT_ID)).thenReturn(1L); // totalItems=2

        assertThrows(IllegalArgumentException.class, () -> service.completeAttempt(LEARNER_ID, ATTEMPT_ID));
    }

    @Test
    void completeAttempt_alreadyCompleted_throws() {
        LearnerPracticeAttempt completed = inProgressAttempt();
        completed.setStatus("COMPLETED");
        when(attempts.findByAttemptIdAndLearner_LearnerId(ATTEMPT_ID, LEARNER_ID)).thenReturn(Optional.of(completed));

        assertThrows(IllegalArgumentException.class, () -> service.completeAttempt(LEARNER_ID, ATTEMPT_ID));
    }
}

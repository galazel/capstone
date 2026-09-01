package com.capstone.rebyu.knowledgecheck.dto;

import java.util.List;

/**
 * The wire shapes for the pop-up knowledge check.
 *
 * <p>Note what is absent: questions. The check is sat on the ordinary attempt
 * runner, so the only thing that crosses this boundary is which exam to open.
 * No question text and no answer key is ever served from here, which keeps this
 * endpoint incapable of leaking a bank the learner has not been issued.
 */
public final class KnowledgeCheckDtos {

    private KnowledgeCheckDtos() {}

    /**
     * Whether a check is on offer, and once minted, which exam it is.
     *
     * @param available   whether a check can be served right now
     * @param reason      why not, when it cannot -- "cooldown" or
     *                    "not-enough-completed-lessons"
     * @param examId      the minted exam, present only on the create path
     * @param itemCount   how many questions the check holds
     * @param lessonNames the finished lessons the questions were drawn from, so
     *                    the modal can say what it is testing rather than
     *                    springing an unexplained quiz
     */
    public record CheckOffer(
            boolean available,
            String reason,
            Long examId,
            int itemCount,
            List<String> lessonNames
    ) {
        public static CheckOffer unavailable(String reason) {
            return new CheckOffer(false, reason, null, 0, List.of());
        }

        /** Eligible, but not yet minted -- the answer to a pre-flight check. */
        public static CheckOffer available(int itemCount, List<String> lessonNames) {
            return new CheckOffer(true, null, null, itemCount, lessonNames);
        }

        public static CheckOffer minted(Long examId, int itemCount, List<String> lessonNames) {
            return new CheckOffer(true, null, examId, itemCount, lessonNames);
        }
    }
}

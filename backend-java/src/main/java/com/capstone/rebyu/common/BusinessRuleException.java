package com.capstone.rebyu.common;

/**
 * Base type for learner-safe business rule violations. Messages are shown to
 * end users, so they must never contain internals, keys, or stack details.
 */
public abstract class BusinessRuleException extends RuntimeException {

    protected BusinessRuleException(String message) {
        super(message);
    }

    public static class CertificationAlreadyEnrolledException extends BusinessRuleException {
        public CertificationAlreadyEnrolledException() {
            super("You are already enrolled in this certification.");
        }
    }

    public static class InvalidPurchaseTransactionException extends BusinessRuleException {
        public InvalidPurchaseTransactionException(String message) {
            super(message);
        }
    }

    public static class PaymentVerificationException extends BusinessRuleException {
        public PaymentVerificationException() {
            super("The payment could not be verified. Please try again.");
        }
    }

    public static class AssessmentNotPublishedException extends BusinessRuleException {
        public AssessmentNotPublishedException() {
            super("This assessment is not available.");
        }
    }

    public static class AssessmentLockedException extends BusinessRuleException {
        public AssessmentLockedException(String message) {
            super(message);
        }
    }

    public static class AssessmentAttemptAlreadySubmittedException extends BusinessRuleException {
        public AssessmentAttemptAlreadySubmittedException() {
            super("This attempt was already submitted.");
        }
    }

    public static class InvalidAssessmentSubmissionException extends BusinessRuleException {
        public InvalidAssessmentSubmissionException(String message) {
            super(message);
        }
    }

    public static class QuestionNotEligibleForAssessmentException extends BusinessRuleException {
        public QuestionNotEligibleForAssessmentException() {
            super("The selected question cannot be used in this assessment.");
        }
    }

    /**
     * A curriculum node an admin asked to delete still has graded learner
     * records under it. Deleting it would take away attempts and results that
     * a learner -- or the institution that bought the certification -- is
     * entitled to keep, so the delete is refused and the reason is named.
     */
    public static class CurriculumNodeInUseException extends BusinessRuleException {
        public CurriculumNodeInUseException(String message) {
            super(message);
        }
    }

    public static class DiagnosticRequiredException extends BusinessRuleException {
        public DiagnosticRequiredException() {
            super("Complete the diagnostic assessment before studying lessons.");
        }
    }

    public static class InvalidPartnershipRequestException extends BusinessRuleException {
        public InvalidPartnershipRequestException(String message) {
            super(message);
        }
    }

    public static class InstitutionGroupRuleException extends BusinessRuleException {
        public InstitutionGroupRuleException(String message) {
            super(message);
        }
    }

    public static class AssessmentAlreadyExistsException extends BusinessRuleException {
        public AssessmentAlreadyExistsException(String message) {
            super(message);
        }
    }

    public static class QuestionAccessException extends BusinessRuleException {
        public QuestionAccessException(String message) {
            super(message);
        }
    }
}

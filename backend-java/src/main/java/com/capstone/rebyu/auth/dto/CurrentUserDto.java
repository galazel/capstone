package com.capstone.rebyu.auth.dto;

// Learner-safe view of the authenticated REBYU account. Never carries tokens,
// password hashes, or raw Cognito payloads.
public record CurrentUserDto(
        Long userId,
        String email,
        String role,
        Long learnerId,
        // Present when the account belongs to an enterprise, so the frontend
        // scopes the enterprise portal to that organization.
        Long enterpriseId,
        String firstName,
        String lastName,
        String displayName
) {
    // Bean-style alias for learnerId() -- controllers across the codebase call
    // this form; records only auto-generate the canonical accessor.
    public Long getLearnerId() {
        return learnerId;
    }
}

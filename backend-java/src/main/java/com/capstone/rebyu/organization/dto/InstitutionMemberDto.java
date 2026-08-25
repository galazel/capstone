package com.capstone.rebyu.organization.dto;

import com.capstone.rebyu.organization.entity.InstitutionMember;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InstitutionMemberDto {
    private Long institutionMemberId;

    @NotNull
    private Long institutionId;

    @NotNull
    private Long userId;

    // Read-only, denormalized from the member's user account so the org portal can
    // label members/authorities without fetching the global users list.
    private String email;

    // Captured at invite time so members/authorities can be shown by name
    // rather than just an email address. Null for pre-existing members.
    private String firstName;
    private String lastName;

    @NotNull
    private InstitutionMember.MemberRole memberRole;

    private boolean isPrimaryContact = false;

    @NotNull
    private LocalDateTime joinedAt;
}

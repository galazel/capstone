package com.capstone.rebyu.institution.dto;

import com.capstone.rebyu.organization.entity.InstitutionMember;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request to provision a brand-new login account for someone the institution
 * wants to manage a group (or otherwise act on the org's behalf) -- e.g. a
 * group leader. The institution supplies the person's info; a Cognito account
 * is created and credentials are emailed to them, mirroring how the
 * institution's own account was created on partnership approval.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class InstitutionMemberInviteRequestDto {

    @NotBlank
    private String firstName;

    @NotBlank
    private String lastName;

    @NotBlank
    @Email
    private String email;

    // Defaults to manager (e.g. group leader/co-admin). Self-service invites can
    // never mint another owner -- that only happens on partnership approval.
    private InstitutionMember.MemberRole memberRole = InstitutionMember.MemberRole.manager;
}

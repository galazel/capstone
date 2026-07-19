package com.capstone.rebyu.enterprise.dto;

import com.capstone.rebyu.organization.entity.EnterpriseMember;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request to provision a brand-new login account for someone the enterprise
 * wants to manage a group (or otherwise act on the org's behalf) -- e.g. a
 * group leader. The enterprise supplies the person's info; a Cognito account
 * is created and credentials are emailed to them, mirroring how the
 * enterprise's own account was created on partnership approval.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EnterpriseMemberInviteRequestDto {

    @NotBlank
    private String firstName;

    @NotBlank
    private String lastName;

    @NotBlank
    @Email
    private String email;

    // Defaults to manager (e.g. group leader/co-admin). Self-service invites can
    // never mint another owner -- that only happens on partnership approval.
    private EnterpriseMember.MemberRole memberRole = EnterpriseMember.MemberRole.manager;
}

package com.capstone.rebyu.enterprisegroup.dto;

import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroupAssignee;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class EnterpriseGroupAssigneeDto {
    private Long enterpriseGroupAssigneeId;

    @NotNull
    private Long enterpriseGroupId;

    @NotNull
    private Long orgCertLearnerId;

    // Read-only, denormalized from the referenced org_cert_learner so the
    // authority UI can display and cross-check the learner without extra calls.
    private Long orgCertId;
    private Long learnerId;

    // Always overwritten server-side from the caller's JWT (see
    // EnterpriseGroupAssigneeController.create), so must stay nullable --
    // the client never supplies it.
    private Long assignedBy;

    private LocalDateTime assignedAt;

    private EnterpriseGroupAssignee.Status status = EnterpriseGroupAssignee.Status.active;

    // Peer-leader distinction within the group; defaults to a regular member.
    private EnterpriseGroupAssignee.Role role = EnterpriseGroupAssignee.Role.member;

    private LocalDateTime removedAt;
}

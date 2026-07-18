package com.capstone.rebyu.notification.controller;

import com.capstone.rebyu.notification.dto.LearnerInvitationDto;
import com.capstone.rebyu.notification.service.LearnerInvitationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// Read-only: the write endpoints (create/update/delete) were removed because they let
// anyone forge a valid, self-computed invitation token for any certification with no
// auth check. The real invitation-sending flow lives in EnterpriseInvitationService.
// getAll/getById are kept because the enterprise dashboard's "Recent invitations" widget
// (use-enterprise-data.js -> enterprise-dashboard-page.jsx) still reads from this path.
@RestController
@RequestMapping("/api/learner-invitations")
@RequiredArgsConstructor
public class LearnerInvitationController {
    private final LearnerInvitationService learnerInvitationService;

    @GetMapping
    public List<LearnerInvitationDto> getAll() {
        return learnerInvitationService.getAll();
    }

    @GetMapping("/{id}")
    public LearnerInvitationDto getById(@PathVariable Long id) {
        return learnerInvitationService.getById(id);
    }
}

package com.capstone.rebyu.user.dto;

import com.capstone.rebyu.assessment.dto.ExamResultDto;
import com.capstone.rebyu.enrollment.dto.LearnerCertificationDto;
import com.capstone.rebyu.enrollment.dto.OrganizationCertificationLearnerDto;
import com.capstone.rebyu.organization.dto.OrganizationCertificateDto;
import com.capstone.rebyu.progress.dto.ActivityLogDto;
import com.capstone.rebyu.progress.dto.LearnerCompletedLessonDto;

import java.util.List;

/**
 * Learner-scoped portal snapshot. Every list is filtered to the authenticated learner
 * server-side, replacing the old browser-side filtering of global lists (all learners,
 * all users, all completed lessons, all exam results, all org allocations).
 */
public record LearnerPortalDto(
        LearnerDto learner,
        UserDto user,
        List<LearnerCertificationDto> learnerCertifications,
        List<LearnerCompletedLessonDto> completedLessons,
        List<ActivityLogDto> activityLogs,
        List<ExamResultDto> examResults,
        List<OrganizationCertificationLearnerDto> orgCertLearners,
        List<OrganizationCertificateDto> orgCertificates
) {}

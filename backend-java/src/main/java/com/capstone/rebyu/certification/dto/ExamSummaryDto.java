package com.capstone.rebyu.certification.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Minimal exam projection attached to a published certification's tree
 * (major/middle/lesson nodes, or the certification itself for
 * certification-scoped exams like the diagnostic/mock exam) so the frontend
 * can display which category assessment, mock exam, or lesson quiz belongs
 * to which node without a separate, unlinked call to the flat exams list.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ExamSummaryDto {
    private Long examId;
    private String title;
    private String examType;
    private String targetScope;
    private Integer totalQuestions;
    private String status;
}

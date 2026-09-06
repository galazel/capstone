package com.capstone.rebyu.assessment.entity;


import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.certification.entity.MajorCategory;
import com.capstone.rebyu.certification.entity.MiddleCategory;
import com.capstone.rebyu.institutiongroup.entity.InstitutionGroup;
import com.capstone.rebyu.user.entity.Learner;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "exams",
        /* Assessment lists and the diagnostic gate both filter exams by
           certification. */
        indexes = @Index(name = "ix_exam_certification", columnList = "certification_id"))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Exam {

    public enum Status {
        DRAFT, PUBLISHED, ARCHIVED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long examId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "certification_id", nullable = false)
    private Certification certification;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_type_id", nullable = false)
    private ExamType examType;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(name = "is_generated", nullable = false)
    private boolean isGenerated = false;

    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    @Column(name = "total_questions", nullable = false)
    private Integer totalQuestions;

    @Column(name = "passing_score", nullable = false, precision = 5, scale = 2)
    private BigDecimal passingScore = new BigDecimal("70.00");

    // Lifecycle columns are nullable so ddl-auto=update can migrate the
    // existing non-empty table; a null status is treated as DRAFT in code.
    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20)
    private Status status;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "instructions", columnDefinition = "TEXT")
    private String instructions;

    /** Required for QUIZ-type exams, null for certification-level exams. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lesson_id")
    private Lesson lesson;

    /** Set for MIDDLE_CATEGORY-scoped assessments. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "middle_category_id")
    private MiddleCategory middleCategory;

    /** Set for MAJOR_CATEGORY-scoped assessments. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "major_category_id")
    private MajorCategory majorCategory;

    /** LESSON | MIDDLE_CATEGORY | MAJOR_CATEGORY | CERTIFICATION. */
    @Column(name = "target_scope", length = 20)
    private String targetScope;

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Nullable so ddl-auto=update can migrate the existing non-empty table;
    // null is treated as true (current behavior: answers are released).
    @Column(name = "release_answers_after_submit")
    private Boolean releaseAnswersAfterSubmit;

    // NULL = official, platform-wide exam (admin-authored, unchanged
    // behavior). Set = one Institution Member's own assessment, scoped to
    // their group -- mirrors MajorCategory.ownerGroup.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_group_id")
    private InstitutionGroup ownerGroup;

    // NULL for every admin-authored exam (the overwhelming majority). Set
    // only on GENERATED_QUIZ/GENERATED_FLASHCARD exams -- the learner whose
    // "make me a quiz" request in the AI tutor produced this one.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "learner_id")
    private Learner learner;

    public Status effectiveStatus() {
        return status == null ? Status.DRAFT : status;
    }

    public boolean effectiveReleaseAnswers() {
        return releaseAnswersAfterSubmit == null || releaseAnswersAfterSubmit;
    }
}

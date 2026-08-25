package com.capstone.rebyu.assessment.entity;


import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.institutiongroup.entity.InstitutionGroup;
import com.capstone.rebyu.user.entity.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "questions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@ToString(onlyExplicitlyIncluded = true)
public class Question {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
    @ToString.Include
    private Long questionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_question_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Question parentQuestion;

    @ToString.Include
    @Column(name = "question_type", nullable = false, length = 30)
    private String questionType;

    @ToString.Include
    @Column(name = "difficulty_level", nullable = false, length = 10)
    private String difficultyLevel;

    @ToString.Include
    @Column(nullable = false, columnDefinition = "TEXT")
    private String questionText;

    @Column(name = "image_key", length = 255)
    private String imageKey;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lesson_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Lesson lesson;

    @ToString.Include
    @Column(name = "total_points", nullable = false, precision = 5, scale = 2)
    private BigDecimal totalPoints = BigDecimal.ONE;

    @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<Choice> choices = new ArrayList<>();

    @OneToOne(mappedBy = "question", orphanRemoval = true, cascade = CascadeType.ALL)
    private DiagramQuestionConfig diagramQuestionConfig;

    @OneToOne(mappedBy = "question", orphanRemoval = true, cascade = CascadeType.ALL)
    private ProgrammingQuestionConfig programmingQuestionConfig;

    @OneToOne(mappedBy = "question", orphanRemoval = true, cascade = CascadeType.ALL)
    private TextQuestionConfig textQuestionConfig;

    // Nullable: questions created before authorship tracking have no known
    // author. Admin, an institution owner, or a group leader can all author
    // questions now, so the question bank needs to record who added what.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private User createdBy;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    // NULL = official, platform-wide question (admin-authored, unchanged).
    // Set = authored by one Institution group; only that group sees and can
    // use it. Mirrors MajorCategory.ownerGroup / Exam.ownerGroup.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_group_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private InstitutionGroup ownerGroup;
}

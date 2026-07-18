package com.capstone.rebyu.learningtools.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "generated_study_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GeneratedStudyItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "study_item_id")
    private Long studyItemId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "study_set_id", nullable = false)
    private GeneratedStudySet studySet;

    /** MCQ | SHORT_ANSWER | CRITICAL_THINKING | FLASHCARD (see V30 CHECK constraint). */
    @Column(name = "item_type", nullable = false, length = 32)
    private String itemType;

    @Column(name = "question_text", nullable = false, columnDefinition = "TEXT")
    private String questionText;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "choices_json", columnDefinition = "JSONB")
    private String choicesJson;

    @Column(name = "correct_answer", columnDefinition = "TEXT")
    private String correctAnswer;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "accepted_answers_json", columnDefinition = "JSONB")
    private String acceptedAnswersJson;

    @Column(columnDefinition = "TEXT")
    private String explanation;

    /** EASY | AVERAGE | HARD (see V30 CHECK constraint). */
    @Column(length = 16)
    private String difficulty;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;
}

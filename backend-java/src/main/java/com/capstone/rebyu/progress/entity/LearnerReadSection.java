package com.capstone.rebyu.progress.entity;

import com.capstone.rebyu.certification.entity.Lesson;
import com.capstone.rebyu.user.entity.Learner;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "learner_read_sections")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LearnerReadSection {
    @EmbeddedId
    private LearnerReadSectionId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "learner_id")
    @MapsId("learnerId")
    private Learner learner;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lesson_id")
    @MapsId("lessonId")
    private Lesson lesson;

    @Column(name = "read_at", nullable = false)
    private LocalDateTime readAt;
}

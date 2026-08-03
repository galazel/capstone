package com.capstone.rebyu.certification.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "certifications")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@ToString(onlyExplicitlyIncluded = true)
public class Certification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
    @ToString.Include
    private Long certificationId;

    @ToString.Include
    @Column(nullable = false, unique = true, length = 150)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(name = "image_key", length = 255)
    private String imageKey;

    @Column(name = "date_created", nullable = true)
    private LocalDateTime dateCreated;

    @OneToMany(mappedBy = "certification", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("majorCategoryId ASC")
    @ToString.Exclude
    private List<MajorCategory> majorCategory = new ArrayList<>();

    private String industry;

    @Column(name = "date_updated")
    private LocalDateTime dateUpdated;

    @Column(name = "status")
    private CertificationStatus status = CertificationStatus.DRAFT;

    /**
     * Shape of the REAL certification exam, as researched by the AI curriculum
     * planner: {@code {total_items, question_types[], notes}}.
     *
     * <p>Written by the Python generation service, not by this application.
     * Null means the planner could not determine it (or the certification
     * predates the column) -- readers must treat null as unknown rather than
     * as an empty exam.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "exam_structure")
    private String examStructure;

    public enum CertificationStatus{
        PUBLISHED, DRAFT
    }
}

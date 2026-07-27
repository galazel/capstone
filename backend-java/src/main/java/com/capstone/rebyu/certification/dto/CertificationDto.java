package com.capstone.rebyu.certification.dto;


import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.entity.MajorCategory;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CertificationDto {
    private Long certificationId;

    @NotBlank
    @Size(max = 150)
    private String title;

    @NotBlank
    private String description;

    @Size(max = 255)
    private String imageKey;

    private LocalDateTime dateCreated;

    private List<MajorCategoryDto> majorCategory;

    private String industry;

    private LocalDateTime dateUpdated;

    private Certification.CertificationStatus status;

    @JsonIgnore
    private MultipartFile file;

    /** Certification-scoped exams (diagnostic, mock exam) -- not tied to any one major/middle/lesson. */
    private List<ExamSummaryDto> exams;

}

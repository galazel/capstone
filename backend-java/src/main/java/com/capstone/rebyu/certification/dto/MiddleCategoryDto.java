package com.capstone.rebyu.certification.dto;


import com.capstone.rebyu.certification.dto.LessonDto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MiddleCategoryDto {
    private Long middleCategoryId;

    @NotNull
    private Long majorCategoryId;

    @NotBlank
    @Size(max = 150)
    private String title;

    private List<LessonDto> lessons;

    /** Middle-category-scoped exams (e.g. the middle category assessment). */
    private List<ExamSummaryDto> exams;
}

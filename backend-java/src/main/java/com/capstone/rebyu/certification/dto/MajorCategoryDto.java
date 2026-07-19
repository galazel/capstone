package com.capstone.rebyu.certification.dto;


import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.entity.MiddleCategory;
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
public class MajorCategoryDto {
    private Long majorCategoryId;

    @NotNull
    private Long certificationId;

    @NotBlank
    @Size(max = 150)
    private String title;

    // NULL = official, platform-wide content. Read-only here -- ownership is
    // set exclusively via the create endpoint's ownerGroupId query param,
    // never accepted directly from this DTO's create/update body.
    private Long ownerGroupId;

    private List<MiddleCategoryDto> middleCategory;
}

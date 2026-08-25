package com.capstone.rebyu.user.dto;


import com.capstone.rebyu.organization.entity.Institution;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserTypeDto {
    private Long userTypeId;

    @NotBlank
    @Pattern(regexp = "learner|institution|admin")
    private String userTypeText;
}

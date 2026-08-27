package com.capstone.rebyu.user.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LearnerDto {
    private Long learnerId;

    @NotNull
    private Long userId;

    @NotBlank
    @Size(max = 50)
    private String username;

    @NotBlank
    @Size(max = 50)
    private String firstName;

    @NotBlank
    @Size(max = 50)
    private String lastName;

    @DecimalMin(value = "0.0")
    @DecimalMax(value = "100.0")
    private Double readinessScore = 0.0;

    @DecimalMin(value = "0.0")
    @DecimalMax(value = "100.0")
    private Double confidenceLevel = 0.0;

    /*
     * Read-only, and deliberately unvalidated.
     *
     * These describe a learner rather than define one: they live on the user
     * record and on enrolments, and the service fills them on the way out. A
     * constraint here would reject a create or update that never intended to
     * send them -- the request would 400 before the field it complains about
     * was ever going to be read.
     *
     * They exist because the admin learner table has columns for them. Without
     * them it rendered "No email provided", "Not affiliated" and a 0% bar for
     * every learner on the platform -- placeholders standing in for data the
     * database had all along.
     */
    private String email;
    private String status;
    private LocalDateTime joinedAt;
    private String organizationName;
    private String learnerType;
    private Integer certificationCount = 0;
    private Double progressPercentage = 0.0;
}
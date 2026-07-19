package com.capstone.rebyu.enterprisegroup.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GroupAnnouncementDto {
    private Long groupAnnouncementId;

    // Path-derived on write, so it stays nullable in the request body.
    private Long enterpriseGroupId;

    @NotBlank
    @Size(max = 200)
    private String title;

    @NotBlank
    private String body;

    private boolean pinned = false;

    // Read-only: server-set from the authenticated author.
    private Long createdByUserId;
    private String createdByEmail;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String status;
}

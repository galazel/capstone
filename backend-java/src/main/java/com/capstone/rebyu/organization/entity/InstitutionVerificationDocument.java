package com.capstone.rebyu.organization.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "institution_verification_documents")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InstitutionVerificationDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long institutionDocumentId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "institution_id", nullable = false)
    private Institution institution;

    @Column(name = "document_type", nullable = false, length = 50)
    private String documentType;

    @Column(name = "file_key", nullable = false, length = 500)
    private String fileKey;

    @Column(name = "uploaded_at", nullable = false)
    private LocalDateTime uploadedAt;
}

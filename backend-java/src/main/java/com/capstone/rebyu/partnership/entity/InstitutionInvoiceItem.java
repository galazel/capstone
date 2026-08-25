package com.capstone.rebyu.partnership.entity;

import com.capstone.rebyu.certification.entity.Certification;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "institution_invoice_items")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InstitutionInvoiceItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long institutionInvoiceItemId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "institution_invoice_id", nullable = false)
    private InstitutionInvoice institutionInvoice;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "certification_id", nullable = false)
    private Certification certification;

    @Column(name = "learner_slots")
    private Integer learnerSlots;

    @Column(name = "validity_months", nullable = false)
    private Integer validityMonths;
}

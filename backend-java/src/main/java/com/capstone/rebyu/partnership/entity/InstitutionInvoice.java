package com.capstone.rebyu.partnership.entity;

import com.capstone.rebyu.organization.entity.Institution;
import com.capstone.rebyu.user.entity.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "institution_invoices")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InstitutionInvoice {

    public enum InvoiceType {
        initial_access, renewal
    }

    public enum Status {
        draft, issued, payment_submitted, paid, rejected, cancelled, VOID
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long institutionInvoiceId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "institution_id", nullable = false)
    private Institution institution;

    @Column(name = "invoice_number", nullable = false, unique = true, length = 50)
    private String invoiceNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "invoice_type", nullable = false, length = 30)
    private InvoiceType invoiceType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "partnership_request_id")
    private PartnershipRequest partnershipRequest;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "renewal_request_id")
    private InstitutionCertificationRenewalRequest renewalRequest;

    @Column(name = "bill_to_name", nullable = false, length = 150)
    private String billToName;

    @Column(name = "bill_to_email", nullable = false, length = 254)
    private String billToEmail;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "discount_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "tax_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal taxRate = BigDecimal.ZERO;

    @Column(name = "tax_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal taxAmount = BigDecimal.ZERO;

    @Column(name = "total_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "issued_at", nullable = false)
    private LocalDateTime issuedAt;

    @Column(name = "payment_reference", length = 100)
    private String paymentReference;

    @Column(name = "payment_proof_key", length = 500)
    private String paymentProofKey;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "verified_by_user_id")
    private User verifiedByUser;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Status status = Status.issued;
}

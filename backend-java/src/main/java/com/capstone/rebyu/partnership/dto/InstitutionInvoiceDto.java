package com.capstone.rebyu.partnership.dto;

import com.capstone.rebyu.partnership.entity.InstitutionInvoice;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InstitutionInvoiceDto {
    private Long institutionInvoiceId;

    @NotBlank
    @Size(max = 50)
    private String invoiceNumber;

    @NotNull
    private InstitutionInvoice.InvoiceType invoiceType;

    private Long institutionId;

    private Long partnershipRequestId;

    private Long renewalRequestId;

    @NotBlank
    @Size(max = 150)
    private String billToName;

    @NotBlank
    @Size(max = 150)
    private String billToEmail;

    @NotNull
    private BigDecimal subtotal;

    private BigDecimal discountAmount = BigDecimal.ZERO;

    private BigDecimal taxRate = BigDecimal.ZERO;

    private BigDecimal taxAmount = BigDecimal.ZERO;

    @NotNull
    private BigDecimal totalAmount;

    @NotNull
    private LocalDateTime issuedAt;

    private String paymentReference;

    private String paymentProofKey;

    private Long verifiedByUserId;

    private LocalDateTime paidAt;

    private InstitutionInvoice.Status status = InstitutionInvoice.Status.issued;

}

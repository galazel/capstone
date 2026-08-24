package com.capstone.rebyu.enrollment.service;

import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.progress.service.AchievementAwardService;
import com.capstone.rebyu.certification.repository.CertificationRepository;
import com.capstone.rebyu.common.BusinessRuleException;
import com.capstone.rebyu.enrollment.dto.PurchaseDtos.PurchaseTransactionDto;
import com.capstone.rebyu.enrollment.entity.LearnerCertification;
import com.capstone.rebyu.enrollment.entity.LearnerOrder;
import com.capstone.rebyu.enrollment.entity.LearnerOrderDetail;
import com.capstone.rebyu.enrollment.repository.LearnerCertificationRepository;
import com.capstone.rebyu.enrollment.repository.LearnerOrderDetailRepository;
import com.capstone.rebyu.enrollment.repository.LearnerOrderRepository;
import com.capstone.rebyu.user.entity.Learner;
import com.capstone.rebyu.user.repository.LearnerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EnrollmentTransactionServiceTest {

    @Mock private CertificationRepository certificationRepository;
    @Mock private LearnerRepository learnerRepository;
    @Mock private LearnerOrderRepository orderRepository;
    @Mock private LearnerOrderDetailRepository orderDetailRepository;
    @Mock private LearnerCertificationRepository enrollmentRepository;
    @Mock private PaymentVerificationService paymentVerificationService;
    @Mock private AchievementAwardService achievementAwardService;

    private EnrollmentTransactionService service;

    private Certification certification;
    private Learner learner;

    @BeforeEach
    void setUp() {
        service = new EnrollmentTransactionService(
                certificationRepository, learnerRepository, orderRepository,
                orderDetailRepository, enrollmentRepository, paymentVerificationService, achievementAwardService);

        certification = new Certification();
        certification.setCertificationId(1L);
        certification.setTitle("IT Passport");

        learner = new Learner();
        learner.setLearnerId(2L);
    }

    @Test
    void freeEnrollmentCreatesOneCompletedTransactionAndActiveEnrollment() {
        when(certificationRepository.findById(1L)).thenReturn(Optional.of(certification));
        when(learnerRepository.findById(2L)).thenReturn(Optional.of(learner));
        when(enrollmentRepository
                .existsByLearner_LearnerIdAndCertification_CertificationIdAndStatus(
                        2L, 1L, LearnerCertification.Status.active))
                .thenReturn(false);
        when(orderRepository.save(any())).thenAnswer(inv -> {
            LearnerOrder order = inv.getArgument(0);
            order.setOrderId(10L);
            return order;
        });
        when(orderDetailRepository.save(any())).thenAnswer(inv -> {
            LearnerOrderDetail detail = inv.getArgument(0);
            detail.setOrderDetailId(20L);
            return detail;
        });
        when(enrollmentRepository.save(any())).thenAnswer(inv -> {
            LearnerCertification enrollment = inv.getArgument(0);
            enrollment.setLearnerCertificationId(30L);
            return enrollment;
        });

        PurchaseTransactionDto result = service.purchase(1L, 2L, "key-1");

        assertEquals("completed", result.status());
        assertEquals("FREE_ENROLLMENT", result.transactionType());
        assertEquals(30L, result.enrollmentId());
        assertFalse(result.requiresPayment());
        verify(orderRepository, times(1)).save(any());
        verify(enrollmentRepository, times(1)).save(any());
    }

    @Test
    void duplicateActiveEnrollmentIsRejected() {
        when(certificationRepository.findById(1L)).thenReturn(Optional.of(certification));
        when(learnerRepository.findById(2L)).thenReturn(Optional.of(learner));
        when(enrollmentRepository
                .existsByLearner_LearnerIdAndCertification_CertificationIdAndStatus(
                        2L, 1L, LearnerCertification.Status.active))
                .thenReturn(true);

        assertThrows(
                BusinessRuleException.CertificationAlreadyEnrolledException.class,
                () -> service.purchase(1L, 2L, null));
        verify(orderRepository, never()).save(any());
    }

    @Test
    void idempotencyKeyReturnsExistingTransactionWithoutDuplicating() {
        LearnerOrder existing = LearnerOrder.builder()
                .orderId(10L)
                .orderNumber("ORD-EXISTING")
                .learner(learner)
                .orderedAt(LocalDateTime.now())
                .subtotal(BigDecimal.TEN)
                .totalAmount(BigDecimal.TEN)
                .status(LearnerOrder.Status.pending)
                .idempotencyKey("key-1")
                .build();
        when(orderRepository.findByIdempotencyKey("key-1"))
                .thenReturn(Optional.of(existing));

        PurchaseTransactionDto result = service.purchase(1L, 2L, "key-1");

        assertEquals(10L, result.transactionId());
        verify(orderRepository, never()).save(any());
        verify(enrollmentRepository, never()).save(any());
    }

    @Test
    void paidPurchaseStaysPendingAndUnverifiedPaymentIsRejected() {
        when(certificationRepository.findById(1L)).thenReturn(Optional.of(certification));
        when(learnerRepository.findById(2L)).thenReturn(Optional.of(learner));
        when(enrollmentRepository
                .existsByLearner_LearnerIdAndCertification_CertificationIdAndStatus(
                        anyLong(), anyLong(), any()))
                .thenReturn(false);
        when(orderRepository.save(any())).thenAnswer(inv -> {
            LearnerOrder order = inv.getArgument(0);
            order.setOrderId(11L);
            return order;
        });
        when(orderDetailRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PurchaseTransactionDto pending = service.purchase(1L, 2L, null);
        assertEquals("pending", pending.status());
        assertTrue(pending.requiresPayment());
        verify(enrollmentRepository, never()).save(any());

        // Confirming with a bad reference must not enroll.
        LearnerOrder order = LearnerOrder.builder()
                .orderId(11L)
                .orderNumber("ORD-PAID")
                .learner(learner)
                .orderedAt(LocalDateTime.now())
                .subtotal(new BigDecimal("1500"))
                .totalAmount(new BigDecimal("1500"))
                .status(LearnerOrder.Status.pending)
                .build();
        LearnerOrderDetail detail = LearnerOrderDetail.builder()
                .orderDetailId(21L)
                .order(order)
                .certification(certification)
                .price(new BigDecimal("1500"))
                .build();
        when(orderRepository.findById(11L)).thenReturn(Optional.of(order));
        when(orderDetailRepository.findByOrder_OrderId(11L))
                .thenReturn(java.util.List.of(detail));
        when(paymentVerificationService.verify(order, "WRONG")).thenReturn(false);

        assertThrows(
                BusinessRuleException.PaymentVerificationException.class,
                () -> service.confirmPayment(11L, 2L, "WRONG"));
        verify(enrollmentRepository, never()).save(any());
    }
}

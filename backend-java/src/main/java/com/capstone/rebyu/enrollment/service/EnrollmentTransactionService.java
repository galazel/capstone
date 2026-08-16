package com.capstone.rebyu.enrollment.service;

import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.repository.CertificationRepository;
import com.capstone.rebyu.common.BusinessRuleException;
import com.capstone.rebyu.enrollment.dto.PurchaseDtos.*;
import com.capstone.rebyu.enrollment.entity.LearnerCertification;
import com.capstone.rebyu.enrollment.entity.LearnerOrder;
import com.capstone.rebyu.enrollment.entity.LearnerOrderDetail;
import com.capstone.rebyu.enrollment.repository.LearnerCertificationRepository;
import com.capstone.rebyu.enrollment.repository.LearnerOrderDetailRepository;
import com.capstone.rebyu.enrollment.repository.LearnerOrderRepository;
import com.capstone.rebyu.progress.service.AchievementAwardService;
import com.capstone.rebyu.user.entity.Learner;
import com.capstone.rebyu.user.repository.LearnerRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/**
 * Transaction One: certification purchase and enrollment. Free enrollments
 * complete immediately; paid purchases stay pending until the payment is
 * verified server-side. Idempotency keys prevent duplicated transactions.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EnrollmentTransactionService {

    private final CertificationRepository certificationRepository;
    private final LearnerRepository learnerRepository;
    private final LearnerOrderRepository orderRepository;
    private final LearnerOrderDetailRepository orderDetailRepository;
    private final LearnerCertificationRepository enrollmentRepository;
    private final PaymentVerificationService paymentVerificationService;
    private final AchievementAwardService achievementAwardService;

    @Transactional
    public PurchaseTransactionDto purchase(
            Long certificationId, Long learnerId, String idempotencyKey) {

        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<LearnerOrder> existing = orderRepository.findByIdempotencyKey(idempotencyKey);
            if (existing.isPresent()) {
                return toTransactionDto(existing.get(), certificationId);
            }
        }

        Certification certification = certificationRepository.findById(certificationId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "Certification not found: " + certificationId));
        Learner learner = learnerRepository.findById(learnerId)
                .orElseThrow(() -> new EntityNotFoundException("Learner not found: " + learnerId));

        if (enrollmentRepository.existsByLearner_LearnerIdAndCertification_CertificationIdAndStatus(
                learnerId, certificationId, LearnerCertification.Status.active)) {
            throw new BusinessRuleException.CertificationAlreadyEnrolledException();
        }

        // Certification prices are legacy data. Learner access is now gated by
        // subscriptions, so starting any published certification creates a
        // free enrollment immediately.
        BigDecimal price = BigDecimal.ZERO;

        LocalDateTime now = LocalDateTime.now();
        LearnerOrder order = LearnerOrder.builder()
                .orderNumber(generateOrderNumber())
                .learner(learner)
                .orderedAt(now)
                .subtotal(price)
                .discountAmount(BigDecimal.ZERO)
                .totalAmount(price)
                .status(LearnerOrder.Status.completed)
                .paidAt(now)
                .idempotencyKey(idempotencyKey != null && !idempotencyKey.isBlank()
                        ? idempotencyKey
                        : UUID.randomUUID().toString())
                .build();
        order = orderRepository.save(order);

        LearnerOrderDetail detail = LearnerOrderDetail.builder()
                .order(order)
                .certification(certification)
                .price(price)
                .build();
        detail = orderDetailRepository.save(detail);

        Long enrollmentId = createEnrollment(learner, certification, detail)
                .getLearnerCertificationId();
        log.info("Free enrollment completed: learner={} certification={}", learnerId, certificationId);

        return new PurchaseTransactionDto(
                order.getOrderId(),
                order.getOrderNumber(),
                learnerId,
                certificationId,
                price,
                order.getStatus().name(),
                "FREE_ENROLLMENT",
                order.getOrderedAt(),
                order.getPaidAt(),
                enrollmentId,
                false
        );
    }

    @Transactional
    public PurchaseTransactionDto confirmPayment(
            Long orderId, Long learnerId, String paymentReference) {

        LearnerOrder order = orderRepository.findById(orderId)
                .orElseThrow(() -> new EntityNotFoundException("Order not found: " + orderId));
        if (!order.getLearner().getLearnerId().equals(learnerId)) {
            throw new EntityNotFoundException("Order not found: " + orderId);
        }

        List<LearnerOrderDetail> details = orderDetailRepository.findByOrder_OrderId(orderId);
        if (details.isEmpty()) {
            throw new BusinessRuleException.InvalidPurchaseTransactionException(
                    "This purchase has no certification attached.");
        }
        LearnerOrderDetail detail = details.get(0);
        Certification certification = detail.getCertification();

        // Idempotent confirm: an already-completed order returns its state.
        if (order.getStatus() == LearnerOrder.Status.completed) {
            Long enrollmentId = enrollmentRepository
                    .findFirstByLearner_LearnerIdAndCertification_CertificationIdAndStatus(
                            learnerId, certification.getCertificationId(),
                            LearnerCertification.Status.active)
                    .map(LearnerCertification::getLearnerCertificationId)
                    .orElse(null);
            return toTransactionDto(order, certification.getCertificationId(), enrollmentId);
        }
        if (order.getStatus() != LearnerOrder.Status.pending) {
            throw new BusinessRuleException.InvalidPurchaseTransactionException(
                    "This purchase can no longer be completed.");
        }

        if (!paymentVerificationService.verify(order, paymentReference)) {
            throw new BusinessRuleException.PaymentVerificationException();
        }

        order.setStatus(LearnerOrder.Status.completed);
        order.setPaidAt(LocalDateTime.now());
        order.setPaymentReference(paymentReference);
        orderRepository.save(order);

        // Guard against a duplicate active enrollment created in between.
        LearnerCertification enrollment = enrollmentRepository
                .findFirstByLearner_LearnerIdAndCertification_CertificationIdAndStatus(
                        learnerId, certification.getCertificationId(),
                        LearnerCertification.Status.active)
                .orElseGet(() -> createEnrollment(order.getLearner(), certification, detail));

        log.info("Payment verified via {}: order={} enrollment={}",
                paymentVerificationService.providerName(),
                orderId, enrollment.getLearnerCertificationId());
        return toTransactionDto(order, certification.getCertificationId(),
                enrollment.getLearnerCertificationId());
    }

    @Transactional(readOnly = true)
    public List<LearnerEnrollmentDto> getEnrollments(Long learnerId) {
        return enrollmentRepository.findByLearner_LearnerId(learnerId).stream()
                .map(enrollment -> new LearnerEnrollmentDto(
                        enrollment.getLearnerCertificationId(),
                        learnerId,
                        enrollment.getCertification().getCertificationId(),
                        enrollment.getCertification().getTitle(),
                        enrollment.getStatus().name().toUpperCase(Locale.ROOT),
                        enrollment.getEnrolledAt(),
                        enrollment.getDiagnosticCompletedAt(),
                        enrollment.getDiagnosticAttemptId()))
                .toList();
    }

    private LearnerCertification createEnrollment(
            Learner learner, Certification certification, LearnerOrderDetail detail) {
        LearnerCertification enrollment = enrollmentRepository.save(LearnerCertification.builder()
                .learner(learner)
                .certification(certification)
                .orderDetail(detail)
                .enrolledAt(LocalDateTime.now())
                .status(LearnerCertification.Status.active)
                .build());
        // "Knowledge Seeker" is the only achievement enrolling can unlock, and
        // this is the one place an enrollment is created.
        achievementAwardService.evaluate(learner.getLearnerId());
        return enrollment;
    }

    private PurchaseTransactionDto toTransactionDto(LearnerOrder order, Long certificationId) {
        return toTransactionDto(order, certificationId, null);
    }

    private PurchaseTransactionDto toTransactionDto(
            LearnerOrder order, Long certificationId, Long enrollmentId) {
        boolean pending = order.getStatus() == LearnerOrder.Status.pending;
        return new PurchaseTransactionDto(
                order.getOrderId(),
                order.getOrderNumber(),
                order.getLearner().getLearnerId(),
                certificationId,
                order.getTotalAmount(),
                order.getStatus().name(),
                order.getTotalAmount() != null && order.getTotalAmount().signum() > 0
                        ? "PAID_PURCHASE" : "FREE_ENROLLMENT",
                order.getOrderedAt(),
                order.getPaidAt(),
                enrollmentId,
                pending
        );
    }

    private String generateOrderNumber() {
        return "ORD-" + UUID.randomUUID().toString()
                .replace("-", "").substring(0, 12).toUpperCase(Locale.ROOT);
    }
}

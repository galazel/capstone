package com.capstone.rebyu.admin.service;

import com.capstone.rebyu.assessment.entity.AssessmentAttempt;
import com.capstone.rebyu.assessment.repository.AssessmentAttemptRepository;
import com.capstone.rebyu.billing.entity.BillingStatus;
import com.capstone.rebyu.billing.repository.InstitutionalLicenseRepository;
import com.capstone.rebyu.billing.repository.LearnerSubscriptionRepository;
import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.repository.CertificationRepository;
import com.capstone.rebyu.enrollment.entity.LearnerCertification;
import com.capstone.rebyu.enrollment.entity.LearnerOrder;
import com.capstone.rebyu.enrollment.repository.LearnerCertificationRepository;
import com.capstone.rebyu.enrollment.repository.LearnerOrderRepository;
import com.capstone.rebyu.organization.repository.EnterpriseRepository;
import com.capstone.rebyu.partnership.entity.PartnershipRequest;
import com.capstone.rebyu.partnership.repository.PartnershipRequestRepository;
import com.capstone.rebyu.user.entity.User;
import com.capstone.rebyu.user.repository.LearnerRepository;
import com.capstone.rebyu.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;

/**
 * The platform counters behind the admin dashboard.
 *
 * One endpoint of aggregates rather than the six global list fetches the page
 * used to do. Counting `GET /learners` in the browser means shipping every
 * learner row to an admin's laptop to learn a single number, and it grows
 * without bound; these are `COUNT`/`SUM` queries that stay the same size as the
 * platform does.
 *
 * Everything here is a real query. Nothing on this dashboard is sample data --
 * a figure that cannot be sourced is reported as null and rendered as a dash,
 * which is honest in a way that a plausible-looking placeholder is not.
 */
@Service
@RequiredArgsConstructor
public class AdminMetricsService {

    /** Statuses that mean money is actually being collected. */
    private static final List<BillingStatus> LIVE_BILLING =
            List.of(BillingStatus.ACTIVE, BillingStatus.TRIALING);

    private final UserRepository userRepository;
    private final LearnerRepository learnerRepository;
    private final EnterpriseRepository enterpriseRepository;
    private final CertificationRepository certificationRepository;
    private final LearnerCertificationRepository learnerCertificationRepository;
    private final PartnershipRequestRepository partnershipRequestRepository;
    private final AssessmentAttemptRepository attemptRepository;
    private final LearnerOrderRepository orderRepository;
    private final LearnerSubscriptionRepository subscriptionRepository;
    private final InstitutionalLicenseRepository licenseRepository;

    public record PeopleMetrics(
            long totalUsers,
            long activeUsers,
            long learners,
            long learnersInCertification,
            long activeEnrollments) {}

    public record CatalogMetrics(
            long organizations,
            long certifications,
            long publishedCertifications,
            long pendingPartnerships) {}

    public record AssessmentMetrics(
            long gradedAttempts,
            long passedAttempts,
            Integer passRate,
            Integer averageScore,
            long attemptsLast30Days) {}

    public record SalesMetrics(
            BigDecimal grossSales,
            BigDecimal salesLast30Days,
            long paidOrders,
            long pendingOrders,
            long activeSubscriptions,
            long activeLicenses) {}

    /** One bar of the "learners per certification" chart. */
    public record CertificationEnrolmentDto(
            Long certificationId,
            String title,
            long learners,
            long enrollments) {}

    /** One row of the "learners who paid" feed. */
    public record PaymentDto(
            Long orderId,
            String orderNumber,
            Long learnerId,
            String learnerName,
            BigDecimal amount,
            LocalDateTime paidAt) {}

    public record PlatformMetrics(
            PeopleMetrics people,
            CatalogMetrics catalog,
            AssessmentMetrics assessments,
            SalesMetrics sales,
            List<CertificationEnrolmentDto> learnersPerCertification,
            List<PaymentDto> recentPayments) {}

    @Transactional(readOnly = true)
    public PlatformMetrics platformMetrics() {
        return new PlatformMetrics(
                people(), catalog(), assessments(), sales(),
                learnersPerCertification(), recentPayments());
    }

    private List<CertificationEnrolmentDto> learnersPerCertification() {
        return learnerCertificationRepository
                .learnersPerCertification(LearnerCertification.Status.active).stream()
                .map(row -> new CertificationEnrolmentDto(
                        row.getCertificationId(),
                        row.getTitle(),
                        row.getLearners(),
                        row.getEnrollments()))
                .toList();
    }

    /**
     * The latest completed orders, with the payer named.
     *
     * Only `completed` orders count as a payment. A pending order is an intent,
     * and listing one here would report money that has not arrived.
     */
    private List<PaymentDto> recentPayments() {
        return orderRepository.findTop8ByStatusOrderByPaidAtDesc(LearnerOrder.Status.completed)
                .stream()
                .map(order -> new PaymentDto(
                        order.getOrderId(),
                        order.getOrderNumber(),
                        order.getLearner() == null ? null : order.getLearner().getLearnerId(),
                        learnerName(order),
                        order.getTotalAmount(),
                        order.getPaidAt()))
                .toList();
    }

    private String learnerName(LearnerOrder order) {
        var learner = order.getLearner();
        if (learner == null) {
            return "Unknown learner";
        }
        String full = ((learner.getFirstName() == null ? "" : learner.getFirstName()) + " "
                + (learner.getLastName() == null ? "" : learner.getLastName())).trim();
        if (!full.isEmpty()) {
            return full;
        }
        return learner.getUsername() == null
                ? "Learner #" + learner.getLearnerId()
                : learner.getUsername();
    }

    private PeopleMetrics people() {
        return new PeopleMetrics(
                userRepository.count(),
                userRepository.countByAccountStatus(User.AccountStatus.active),
                learnerRepository.count(),
                // Distinct people, not enrollment rows: a learner holding three
                // active certifications is one person currently studying.
                learnerCertificationRepository
                        .countDistinctLearnersByStatus(LearnerCertification.Status.active),
                learnerCertificationRepository.countByStatus(LearnerCertification.Status.active));
    }

    private CatalogMetrics catalog() {
        long pending = partnershipRequestRepository.countByStatus(PartnershipRequest.Status.PENDING)
                + partnershipRequestRepository.countByStatus(PartnershipRequest.Status.UNDER_REVIEW);
        return new CatalogMetrics(
                enterpriseRepository.count(),
                certificationRepository.count(),
                certificationRepository.countByStatus(Certification.CertificationStatus.PUBLISHED),
                pending);
    }

    private AssessmentMetrics assessments() {
        long graded = attemptRepository.countByStatus(AssessmentAttempt.Status.SUBMITTED);
        long passed = attemptRepository
                .countByStatusAndPassed(AssessmentAttempt.Status.SUBMITTED, Boolean.TRUE);
        Double average = attemptRepository
                .averagePercentageByStatus(AssessmentAttempt.Status.SUBMITTED);
        return new AssessmentMetrics(
                graded,
                passed,
                // Null rather than 0% when nothing has been graded: "no data" and
                // "everyone failed" are different facts and must not look alike.
                graded == 0 ? null : (int) Math.round(passed * 100.0 / graded),
                average == null ? null : (int) Math.round(average),
                attemptRepository.countByStatusAndSubmittedAtGreaterThanEqual(
                        AssessmentAttempt.Status.SUBMITTED, LocalDateTime.now().minusDays(30)));
    }

    private SalesMetrics sales() {
        return new SalesMetrics(
                money(orderRepository.sumTotalAmountByStatus(LearnerOrder.Status.completed)),
                money(orderRepository.sumTotalAmountByStatusSince(
                        LearnerOrder.Status.completed, LocalDateTime.now().minusDays(30))),
                orderRepository.countByStatus(LearnerOrder.Status.completed),
                orderRepository.countByStatus(LearnerOrder.Status.pending),
                subscriptionRepository.countByStatusIn(LIVE_BILLING),
                licenseRepository.countByLicenseStatusIn(LIVE_BILLING));
    }

    /** SUM over no rows is null in SQL; zero is the truthful reading for sales. */
    private BigDecimal money(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }
}

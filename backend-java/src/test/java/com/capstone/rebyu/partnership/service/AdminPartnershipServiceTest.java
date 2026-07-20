package com.capstone.rebyu.partnership.service;

import com.capstone.rebyu.auth.service.CognitoAdminService;
import com.capstone.rebyu.notification.service.NotificationService;
import com.capstone.rebyu.organization.entity.Enterprise;
import com.capstone.rebyu.organization.entity.EnterpriseMember;
import com.capstone.rebyu.organization.repository.EnterpriseMemberRepository;
import com.capstone.rebyu.organization.repository.EnterpriseRepository;
import com.capstone.rebyu.organization.repository.OrganizationCertificateRepository;
import com.capstone.rebyu.partnership.dto.AdminPartnershipDtos.PartnershipRequestDetailDto;
import com.capstone.rebyu.partnership.entity.PartnershipRequest;
import com.capstone.rebyu.partnership.repository.PartnershipRequestItemRepository;
import com.capstone.rebyu.partnership.repository.PartnershipRequestRepository;
import com.capstone.rebyu.user.entity.User;
import com.capstone.rebyu.user.entity.UserType;
import com.capstone.rebyu.user.repository.UserRepository;
import com.capstone.rebyu.user.repository.UserTypeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminPartnershipServiceTest {

    private static final Long REQUEST_ID = 1L;
    private static final Long EXISTING_ENTERPRISE_ID = 10L;
    private static final Long NEW_ENTERPRISE_ID = 11L;
    private static final String ORG_EMAIL = "contact@acme.com";
    private static final String ORG_NAME = "Acme Corp";

    private PartnershipRequestRepository requestRepository;
    private PartnershipRequestItemRepository itemRepository;
    private EnterpriseRepository enterpriseRepository;
    private OrganizationCertificateRepository organizationCertificateRepository;
    private EnterpriseMemberRepository enterpriseMemberRepository;
    private UserRepository userRepository;
    private UserTypeRepository userTypeRepository;
    private CognitoAdminService cognitoAdminService;
    private NotificationService notificationService;

    private AdminPartnershipService service;

    @BeforeEach
    void setUp() {
        requestRepository = mock(PartnershipRequestRepository.class);
        itemRepository = mock(PartnershipRequestItemRepository.class);
        enterpriseRepository = mock(EnterpriseRepository.class);
        organizationCertificateRepository = mock(OrganizationCertificateRepository.class);
        enterpriseMemberRepository = mock(EnterpriseMemberRepository.class);
        userRepository = mock(UserRepository.class);
        userTypeRepository = mock(UserTypeRepository.class);
        cognitoAdminService = mock(CognitoAdminService.class);
        notificationService = mock(NotificationService.class);

        service = new AdminPartnershipService(
                requestRepository, itemRepository, enterpriseRepository,
                organizationCertificateRepository, enterpriseMemberRepository,
                userRepository, userTypeRepository, cognitoAdminService, notificationService);

        // Common approve() plumbing: no certificate items to process, request save is a no-op passthrough.
        when(itemRepository.findByPartnershipRequest_RequestId(REQUEST_ID)).thenReturn(List.of());
        when(requestRepository.save(any(PartnershipRequest.class))).thenAnswer(inv -> inv.getArgument(0));
        when(enterpriseRepository.save(any(Enterprise.class))).thenAnswer(inv -> {
            Enterprise e = inv.getArgument(0);
            if (e.getEnterpriseId() == null) {
                e.setEnterpriseId(NEW_ENTERPRISE_ID);
            }
            return e;
        });
    }

    private PartnershipRequest pendingRequest() {
        return PartnershipRequest.builder()
                .requestId(REQUEST_ID)
                .referenceNumber("REF-001")
                .organizationName(ORG_NAME)
                .organizationEmail(ORG_EMAIL)
                .contactPersonName("Jane Doe")
                .contactNumber("123456")
                .organizationAddress("123 Street")
                .submittedAt(LocalDateTime.now())
                .status(PartnershipRequest.Status.PENDING)
                .build();
    }

    private Enterprise existingEnterprise(String name) {
        return Enterprise.builder()
                .enterpriseId(EXISTING_ENTERPRISE_ID)
                .enterpriseName(name)
                .organizationType(Enterprise.OrganizationType.other)
                .industry("General")
                .primaryContactName("Old Contact")
                .primaryContactEmail(ORG_EMAIL)
                .isVerified(true)
                .joinedAt(LocalDateTime.now())
                .build();
    }

    // ---- 1: email matches -> the existing Enterprise is reused (even if the name differs) ----
    @Test
    void approve_emailMatches_reusesExistingEnterpriseEvenIfNameDiffers() {
        PartnershipRequest request = pendingRequest();
        when(requestRepository.findById(REQUEST_ID)).thenReturn(Optional.of(request));
        when(enterpriseRepository.findByPrimaryContactEmailIgnoreCase(ORG_EMAIL))
                .thenReturn(Optional.of(existingEnterprise("A Totally Different Org")));
        when(enterpriseMemberRepository.findByEnterprise_EnterpriseId(any())).thenReturn(List.of());
        when(cognitoAdminService.createEnterpriseAccount(anyString(), anyString(), anyString()))
                .thenReturn(new CognitoAdminService.ProvisionResult(true, "sub-123", "emailed"));
        when(userTypeRepository.findByUserTypeText("ENTERPRISE"))
                .thenReturn(Optional.of(new UserType()));
        when(userRepository.findByEmailIgnoreCase(ORG_EMAIL)).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        PartnershipRequestDetailDto result = service.approve(REQUEST_ID, "ok", "admin");

        // Reused the organization already on file (by contact email); the account
        // is provisioned on it and no duplicate Enterprise is created.
        assertEquals(EXISTING_ENTERPRISE_ID, result.enterpriseId());
        verify(enterpriseRepository, never()).save(any(Enterprise.class));
    }

    // ---- 2: email AND name both match -> the existing Enterprise is reused ----
    @Test
    void approve_emailAndNameMatch_reusesExistingEnterprise() {
        PartnershipRequest request = pendingRequest();
        when(requestRepository.findById(REQUEST_ID)).thenReturn(Optional.of(request));
        when(enterpriseRepository.findByPrimaryContactEmailIgnoreCase(ORG_EMAIL))
                .thenReturn(Optional.of(existingEnterprise(ORG_NAME)));
        when(enterpriseMemberRepository.findByEnterprise_EnterpriseId(EXISTING_ENTERPRISE_ID))
                .thenReturn(List.of()); // no owner linked yet
        when(cognitoAdminService.createEnterpriseAccount(anyString(), anyString(), anyString()))
                .thenReturn(new CognitoAdminService.ProvisionResult(true, "sub-123", "emailed"));
        when(userTypeRepository.findByUserTypeText("ENTERPRISE"))
                .thenReturn(Optional.of(new UserType()));
        when(userRepository.findByEmailIgnoreCase(ORG_EMAIL)).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        PartnershipRequestDetailDto result = service.approve(REQUEST_ID, "ok", "admin");

        assertEquals(EXISTING_ENTERPRISE_ID, result.enterpriseId());
        // No brand-new Enterprise should have been created/persisted.
        verify(enterpriseRepository, never()).save(any(Enterprise.class));
    }

    // ---- 3: Cognito UsernameExistsException path, local User already exists -> linked as owner ----
    @Test
    void provisionEnterpriseAccount_usernameExists_existingLocalUser_linksAsOwner() {
        PartnershipRequest request = pendingRequest();
        when(requestRepository.findById(REQUEST_ID)).thenReturn(Optional.of(request));
        when(enterpriseRepository.findByPrimaryContactEmailIgnoreCase(ORG_EMAIL)).thenReturn(Optional.empty());
        when(enterpriseRepository.findByEnterpriseNameIgnoreCase(ORG_NAME)).thenReturn(Optional.empty());
        when(enterpriseMemberRepository.findByEnterprise_EnterpriseId(any())).thenReturn(List.of());
        when(cognitoAdminService.createEnterpriseAccount(anyString(), anyString(), anyString()))
                .thenReturn(new CognitoAdminService.ProvisionResult(false, null, "already exists"));

        User existingUser = User.builder()
                .userId(55L)
                .email(ORG_EMAIL)
                .build();
        when(userRepository.findByEmailIgnoreCase(ORG_EMAIL)).thenReturn(Optional.of(existingUser));
        when(enterpriseMemberRepository.save(any(EnterpriseMember.class))).thenAnswer(inv -> inv.getArgument(0));

        service.approve(REQUEST_ID, "ok", "admin");

        verify(enterpriseMemberRepository, times(1)).save(any(EnterpriseMember.class));
        // The user-type lookup / new-user creation path (only used when a Cognito identity exists) is skipped.
        verify(userTypeRepository, never()).findByUserTypeText(anyString());
        verify(userRepository, never()).save(any(User.class));
    }

    // ---- 4: Cognito UsernameExistsException path, no local User -> no EnterpriseMember, no exception ----
    @Test
    void provisionEnterpriseAccount_usernameExists_noLocalUser_skipsLinkingWithoutError() {
        PartnershipRequest request = pendingRequest();
        when(requestRepository.findById(REQUEST_ID)).thenReturn(Optional.of(request));
        when(enterpriseRepository.findByPrimaryContactEmailIgnoreCase(ORG_EMAIL)).thenReturn(Optional.empty());
        when(enterpriseRepository.findByEnterpriseNameIgnoreCase(ORG_NAME)).thenReturn(Optional.empty());
        when(enterpriseMemberRepository.findByEnterprise_EnterpriseId(any())).thenReturn(List.of());
        when(cognitoAdminService.createEnterpriseAccount(anyString(), anyString(), anyString()))
                .thenReturn(new CognitoAdminService.ProvisionResult(false, null, "already exists"));
        when(userRepository.findByEmailIgnoreCase(ORG_EMAIL)).thenReturn(Optional.empty());

        PartnershipRequestDetailDto result = service.approve(REQUEST_ID, "ok", "admin");

        assertNotNull(result);
        verify(enterpriseMemberRepository, never()).save(any(EnterpriseMember.class));
        verify(userRepository, never()).save(any(User.class));
    }
}

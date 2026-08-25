package com.capstone.rebyu.partnership.service;

import com.capstone.rebyu.auth.service.CognitoAdminService;
import com.capstone.rebyu.notification.service.NotificationService;
import com.capstone.rebyu.organization.entity.Institution;
import com.capstone.rebyu.organization.entity.InstitutionMember;
import com.capstone.rebyu.organization.repository.InstitutionMemberRepository;
import com.capstone.rebyu.organization.repository.InstitutionRepository;
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
    private static final Long EXISTING_INSTITUTION_ID = 10L;
    private static final Long NEW_INSTITUTION_ID = 11L;
    private static final String ORG_EMAIL = "contact@acme.com";
    private static final String ORG_NAME = "Acme Corp";

    private PartnershipRequestRepository requestRepository;
    private PartnershipRequestItemRepository itemRepository;
    private InstitutionRepository institutionRepository;
    private OrganizationCertificateRepository organizationCertificateRepository;
    private InstitutionMemberRepository institutionMemberRepository;
    private UserRepository userRepository;
    private UserTypeRepository userTypeRepository;
    private CognitoAdminService cognitoAdminService;
    private NotificationService notificationService;

    private AdminPartnershipService service;

    @BeforeEach
    void setUp() {
        requestRepository = mock(PartnershipRequestRepository.class);
        itemRepository = mock(PartnershipRequestItemRepository.class);
        institutionRepository = mock(InstitutionRepository.class);
        organizationCertificateRepository = mock(OrganizationCertificateRepository.class);
        institutionMemberRepository = mock(InstitutionMemberRepository.class);
        userRepository = mock(UserRepository.class);
        userTypeRepository = mock(UserTypeRepository.class);
        cognitoAdminService = mock(CognitoAdminService.class);
        notificationService = mock(NotificationService.class);

        service = new AdminPartnershipService(
                requestRepository, itemRepository, institutionRepository,
                organizationCertificateRepository, institutionMemberRepository,
                userRepository, userTypeRepository, cognitoAdminService, notificationService);

        // Common approve() plumbing: no certificate items to process, request save is a no-op passthrough.
        when(itemRepository.findByPartnershipRequest_RequestId(REQUEST_ID)).thenReturn(List.of());
        when(requestRepository.save(any(PartnershipRequest.class))).thenAnswer(inv -> inv.getArgument(0));
        when(institutionRepository.save(any(Institution.class))).thenAnswer(inv -> {
            Institution e = inv.getArgument(0);
            if (e.getInstitutionId() == null) {
                e.setInstitutionId(NEW_INSTITUTION_ID);
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

    private Institution existingInstitution(String name) {
        return Institution.builder()
                .institutionId(EXISTING_INSTITUTION_ID)
                .institutionName(name)
                .organizationType(Institution.OrganizationType.other)
                .industry("General")
                .primaryContactName("Old Contact")
                .primaryContactEmail(ORG_EMAIL)
                .isVerified(true)
                .joinedAt(LocalDateTime.now())
                .build();
    }

    // ---- 1: email matches -> the existing Institution is reused (even if the name differs) ----
    @Test
    void approve_emailMatches_reusesExistingInstitutionEvenIfNameDiffers() {
        PartnershipRequest request = pendingRequest();
        when(requestRepository.findById(REQUEST_ID)).thenReturn(Optional.of(request));
        when(institutionRepository.findByPrimaryContactEmailIgnoreCase(ORG_EMAIL))
                .thenReturn(Optional.of(existingInstitution("A Totally Different Org")));
        when(institutionMemberRepository.findByInstitution_InstitutionId(any())).thenReturn(List.of());
        when(cognitoAdminService.createInstitutionAccount(anyString(), anyString(), anyString()))
                .thenReturn(new CognitoAdminService.ProvisionResult(true, "sub-123", "emailed"));
        when(userTypeRepository.findByUserTypeText("INSTITUTION"))
                .thenReturn(Optional.of(new UserType()));
        when(userRepository.findByEmailIgnoreCase(ORG_EMAIL)).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        PartnershipRequestDetailDto result = service.approve(REQUEST_ID, "ok", "admin");

        // Reused the organization already on file (by contact email); the account
        // is provisioned on it and no duplicate Institution is created.
        assertEquals(EXISTING_INSTITUTION_ID, result.institutionId());
        verify(institutionRepository, never()).save(any(Institution.class));
    }

    // ---- 2: email AND name both match -> the existing Institution is reused ----
    @Test
    void approve_emailAndNameMatch_reusesExistingInstitution() {
        PartnershipRequest request = pendingRequest();
        when(requestRepository.findById(REQUEST_ID)).thenReturn(Optional.of(request));
        when(institutionRepository.findByPrimaryContactEmailIgnoreCase(ORG_EMAIL))
                .thenReturn(Optional.of(existingInstitution(ORG_NAME)));
        when(institutionMemberRepository.findByInstitution_InstitutionId(EXISTING_INSTITUTION_ID))
                .thenReturn(List.of()); // no owner linked yet
        when(cognitoAdminService.createInstitutionAccount(anyString(), anyString(), anyString()))
                .thenReturn(new CognitoAdminService.ProvisionResult(true, "sub-123", "emailed"));
        when(userTypeRepository.findByUserTypeText("INSTITUTION"))
                .thenReturn(Optional.of(new UserType()));
        when(userRepository.findByEmailIgnoreCase(ORG_EMAIL)).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        PartnershipRequestDetailDto result = service.approve(REQUEST_ID, "ok", "admin");

        assertEquals(EXISTING_INSTITUTION_ID, result.institutionId());
        // No brand-new Institution should have been created/persisted.
        verify(institutionRepository, never()).save(any(Institution.class));
    }

    // ---- 3: Cognito UsernameExistsException path, local User already exists -> linked as owner ----
    @Test
    void provisionInstitutionAccount_usernameExists_existingLocalUser_linksAsOwner() {
        PartnershipRequest request = pendingRequest();
        when(requestRepository.findById(REQUEST_ID)).thenReturn(Optional.of(request));
        when(institutionRepository.findByPrimaryContactEmailIgnoreCase(ORG_EMAIL)).thenReturn(Optional.empty());
        when(institutionRepository.findByInstitutionNameIgnoreCase(ORG_NAME)).thenReturn(Optional.empty());
        when(institutionMemberRepository.findByInstitution_InstitutionId(any())).thenReturn(List.of());
        when(cognitoAdminService.createInstitutionAccount(anyString(), anyString(), anyString()))
                .thenReturn(new CognitoAdminService.ProvisionResult(false, null, "already exists"));

        User existingUser = User.builder()
                .userId(55L)
                .email(ORG_EMAIL)
                .build();
        when(userRepository.findByEmailIgnoreCase(ORG_EMAIL)).thenReturn(Optional.of(existingUser));
        when(institutionMemberRepository.save(any(InstitutionMember.class))).thenAnswer(inv -> inv.getArgument(0));

        service.approve(REQUEST_ID, "ok", "admin");

        verify(institutionMemberRepository, times(1)).save(any(InstitutionMember.class));
        // The user-type lookup / new-user creation path (only used when a Cognito identity exists) is skipped.
        verify(userTypeRepository, never()).findByUserTypeText(anyString());
        verify(userRepository, never()).save(any(User.class));
    }

    // ---- 4: Cognito UsernameExistsException path, no local User -> no InstitutionMember, no exception ----
    @Test
    void provisionInstitutionAccount_usernameExists_noLocalUser_skipsLinkingWithoutError() {
        PartnershipRequest request = pendingRequest();
        when(requestRepository.findById(REQUEST_ID)).thenReturn(Optional.of(request));
        when(institutionRepository.findByPrimaryContactEmailIgnoreCase(ORG_EMAIL)).thenReturn(Optional.empty());
        when(institutionRepository.findByInstitutionNameIgnoreCase(ORG_NAME)).thenReturn(Optional.empty());
        when(institutionMemberRepository.findByInstitution_InstitutionId(any())).thenReturn(List.of());
        when(cognitoAdminService.createInstitutionAccount(anyString(), anyString(), anyString()))
                .thenReturn(new CognitoAdminService.ProvisionResult(false, null, "already exists"));
        when(userRepository.findByEmailIgnoreCase(ORG_EMAIL)).thenReturn(Optional.empty());

        PartnershipRequestDetailDto result = service.approve(REQUEST_ID, "ok", "admin");

        assertNotNull(result);
        verify(institutionMemberRepository, never()).save(any(InstitutionMember.class));
        verify(userRepository, never()).save(any(User.class));
    }
}

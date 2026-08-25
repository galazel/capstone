package com.capstone.rebyu.auth.service;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.user.entity.Learner;
import com.capstone.rebyu.user.entity.User;
import com.capstone.rebyu.user.entity.UserType;
import com.capstone.rebyu.user.repository.LearnerRepository;
import com.capstone.rebyu.user.repository.UserRepository;
import com.capstone.rebyu.user.repository.UserTypeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.oauth2.jwt.Jwt;
import software.amazon.awssdk.services.cognitoidentityprovider.CognitoIdentityProviderClient;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AttributeType;
import software.amazon.awssdk.services.cognitoidentityprovider.model.GetUserRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.GetUserResponse;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CognitoAuthServiceTest {

    private UserRepository userRepository;
    private UserTypeRepository userTypeRepository;
    private LearnerRepository learnerRepository;
    private com.capstone.rebyu.organization.repository.InstitutionMemberRepository institutionMemberRepository;
    private com.capstone.rebyu.organization.repository.InstitutionRepository institutionRepository;
    private CognitoIdentityProviderClient cognitoClient;
    private CognitoAuthService service;

    private static final String SUB = "11111111-2222-3333-4444-555555555555";

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        userTypeRepository = mock(UserTypeRepository.class);
        learnerRepository = mock(LearnerRepository.class);
        institutionMemberRepository =
                mock(com.capstone.rebyu.organization.repository.InstitutionMemberRepository.class);
        institutionRepository = mock(com.capstone.rebyu.organization.repository.InstitutionRepository.class);
        cognitoClient = mock(CognitoIdentityProviderClient.class);
        when(institutionMemberRepository.findByUser_UserId(org.mockito.ArgumentMatchers.anyLong()))
                .thenReturn(java.util.List.of());
        // None of these test accounts are institution contacts -- ensureInstitutionLinkage
        // must be a no-op for them.
        when(institutionRepository.findByPrimaryContactEmailIgnoreCase(org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(Optional.empty());
        service = new CognitoAuthService(
                userRepository, userTypeRepository, learnerRepository,
                institutionMemberRepository, institutionRepository, cognitoClient);
    }

    private Jwt jwt() {
        return Jwt.withTokenValue("access-token")
                .header("alg", "RS256")
                .subject(SUB)
                .claim("token_use", "access")
                .build();
    }

    private User existingUser(Long id, String email, String sub) {
        UserType type = new UserType();
        type.setUserTypeText("LEARNER");
        return User.builder()
                .userId(id)
                .userType(type)
                .email(email)
                .passwordHash("x")
                .accountStatus(User.AccountStatus.active)
                .joinedAt(LocalDateTime.now())
                .cognitoSub(sub)
                .build();
    }

    private void stubCognitoEmail(String email) {
        when(cognitoClient.getUser(any(GetUserRequest.class))).thenReturn(
                GetUserResponse.builder()
                        .username("cognito-user")
                        .userAttributes(
                                AttributeType.builder().name("email").value(email).build())
                        .build());
    }

    @Test
    void alreadyLinkedUserIsReturnedWithoutProvisioning() {
        User linked = existingUser(7L, "juan@rebyu.test", SUB);
        when(userRepository.findByCognitoSub(SUB)).thenReturn(Optional.of(linked));
        when(learnerRepository.findByUser_UserId(7L)).thenReturn(Optional.empty());

        CurrentUserDto dto = service.syncCurrentUser(jwt(), "access-token");

        assertEquals(7L, dto.userId());
        assertEquals("LEARNER", dto.role());
        verify(cognitoClient, never()).getUser(any(GetUserRequest.class));
        verify(userRepository, never()).save(any());
    }

    @Test
    void existingEmailAccountIsLinkedNotDuplicated() {
        when(userRepository.findByCognitoSub(SUB)).thenReturn(Optional.empty());
        stubCognitoEmail("juan@rebyu.test");
        User byEmail = existingUser(9L, "juan@rebyu.test", null);
        when(userRepository.findByEmailIgnoreCase("juan@rebyu.test"))
                .thenReturn(Optional.of(byEmail));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(learnerRepository.findByUser_UserId(9L)).thenReturn(Optional.empty());

        CurrentUserDto dto = service.syncCurrentUser(jwt(), "access-token");

        assertEquals(9L, dto.userId());
        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(saved.capture());
        assertEquals(SUB, saved.getValue().getCognitoSub());
        // No new learner profile is created for an existing account.
        verify(learnerRepository, never()).save(any(Learner.class));
    }

    @Test
    void unknownUserIsProvisionedAsLearnerOnly() {
        when(userRepository.findByCognitoSub(SUB)).thenReturn(Optional.empty());
        stubCognitoEmail("new.learner@rebyu.test");
        when(userRepository.findByEmailIgnoreCase("new.learner@rebyu.test"))
                .thenReturn(Optional.empty());
        UserType learnerType = new UserType();
        learnerType.setUserTypeText("LEARNER");
        when(userTypeRepository.findByUserTypeText("LEARNER"))
                .thenReturn(Optional.of(learnerType));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User user = inv.getArgument(0);
            user.setUserId(42L);
            return user;
        });
        when(learnerRepository.existsByUsername(any())).thenReturn(false);
        when(learnerRepository.save(any(Learner.class))).thenAnswer(inv -> inv.getArgument(0));
        when(learnerRepository.findByUser_UserId(42L)).thenReturn(Optional.empty());

        CurrentUserDto dto = service.syncCurrentUser(jwt(), "access-token");

        assertEquals(42L, dto.userId());
        // Self-registration must never grant elevated access.
        assertEquals("LEARNER", dto.role());

        ArgumentCaptor<Learner> learner = ArgumentCaptor.forClass(Learner.class);
        verify(learnerRepository).save(learner.capture());
        assertNotNull(learner.getValue().getUsername());
        // NOT NULL columns must be set explicitly (@Builder ignores field
        // defaults) or provisioning fails at flush time.
        assertNotNull(learner.getValue().getReadinessScore());
        assertNotNull(learner.getValue().getConfidenceLevel());
    }

    @Test
    void emailBoundToDifferentSubjectIsRejected() {
        when(userRepository.findByCognitoSub(SUB)).thenReturn(Optional.empty());
        stubCognitoEmail("taken@rebyu.test");
        when(userRepository.findByEmailIgnoreCase("taken@rebyu.test"))
                .thenReturn(Optional.of(existingUser(3L, "taken@rebyu.test", "other-sub")));

        assertThrows(IllegalStateException.class,
                () -> service.syncCurrentUser(jwt(), "access-token"));
        verify(userRepository, never()).save(any());
    }
}

package com.capstone.rebyu.enterprise;

import com.capstone.rebyu.auth.service.CognitoAdminService;
import com.capstone.rebyu.common.BusinessRuleException;
import com.capstone.rebyu.enterprise.dto.EnterpriseMemberInviteRequestDto;
import com.capstone.rebyu.organization.dto.EnterpriseMemberDto;
import com.capstone.rebyu.organization.entity.Enterprise;
import com.capstone.rebyu.organization.entity.EnterpriseMember;
import com.capstone.rebyu.organization.mapper.EnterpriseMemberMapper;
import com.capstone.rebyu.organization.repository.EnterpriseMemberRepository;
import com.capstone.rebyu.user.entity.User;
import com.capstone.rebyu.user.entity.UserType;
import com.capstone.rebyu.user.repository.UserRepository;
import com.capstone.rebyu.user.repository.UserTypeRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Lets an enterprise create a login account for someone new -- a group leader,
 * a co-admin -- the same way the enterprise's own owner account was created on
 * partnership approval: a Cognito account is minted (credentials emailed), and
 * the person is linked as an EnterpriseMember of the caller's own organization.
 *
 * Never mints an "owner": that role is reserved for the account created when
 * the admin approves the partnership request.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EnterpriseMemberProvisioningService {

    public record InviteResult(EnterpriseMemberDto member, boolean emailed, String note) {}

    private final CognitoAdminService cognitoAdminService;
    private final UserRepository userRepository;
    private final UserTypeRepository userTypeRepository;
    private final EnterpriseMemberRepository enterpriseMemberRepository;
    private final EnterpriseMemberMapper enterpriseMemberMapper;

    private static final String ENTERPRISE_USER_TYPE = "ENTERPRISE";

    @Transactional
    public InviteResult inviteMember(Enterprise enterprise, EnterpriseMemberInviteRequestDto request) {
        if (request.getMemberRole() == EnterpriseMember.MemberRole.owner) {
            throw new BusinessRuleException.EnterpriseGroupRuleException(
                    "An owner account can only be created when a partnership request is approved.");
        }

        User existingUser = userRepository.findByEmailIgnoreCase(request.getEmail()).orElse(null);
        if (existingUser != null) {
            boolean alreadyMember = !enterpriseMemberRepository
                    .findByEnterprise_EnterpriseIdAndUser_UserId(
                            enterprise.getEnterpriseId(), existingUser.getUserId())
                    .isEmpty();
            if (alreadyMember) {
                throw new BusinessRuleException.EnterpriseGroupRuleException(
                        "This person is already a member of your organization.");
            }
        }

        CognitoAdminService.ProvisionResult provision = cognitoAdminService.createEnterpriseAccount(
                request.getEmail(), request.getFirstName(), request.getLastName());

        User user = existingUser;
        if (provision.cognitoSub() != null || provision.emailed()) {
            UserType enterpriseType = userTypeRepository.findByUserTypeText(ENTERPRISE_USER_TYPE)
                    .orElseGet(() -> {
                        UserType type = new UserType();
                        type.setUserTypeText(ENTERPRISE_USER_TYPE);
                        return userTypeRepository.save(type);
                    });

            if (user == null) {
                user = User.builder()
                        .userType(enterpriseType)
                        .email(request.getEmail())
                        .passwordHash("COGNITO")
                        .accountStatus(User.AccountStatus.active)
                        .joinedAt(LocalDateTime.now())
                        .cognitoSub(provision.cognitoSub())
                        .build();
            }
            user.setUserType(enterpriseType);
            if (user.getCognitoSub() == null && provision.cognitoSub() != null) {
                user.setCognitoSub(provision.cognitoSub());
            }
            user = userRepository.save(user);
        } else if (user == null) {
            // Cognito says the account already exists, but we have no local User
            // record to link it to -- can't safely add them as a member.
            throw new BusinessRuleException.EnterpriseGroupRuleException(
                    "An account already exists for " + request.getEmail()
                            + ", but it could not be linked automatically. Ask them to sign in once first.");
        }

        EnterpriseMember member = EnterpriseMember.builder()
                .enterprise(enterprise)
                .user(user)
                .firstName(request.getFirstName().trim())
                .lastName(request.getLastName().trim())
                .memberRole(request.getMemberRole())
                .isPrimaryContact(false)
                .joinedAt(LocalDateTime.now())
                .build();
        member = enterpriseMemberRepository.save(member);

        log.info("Enterprise {} invited new member {} (role={}); emailed={}",
                enterprise.getEnterpriseId(), request.getEmail(), request.getMemberRole(), provision.emailed());

        return new InviteResult(enterpriseMemberMapper.toDto(member), provision.emailed(), provision.note());
    }
}

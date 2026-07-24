package com.capstone.rebyu.enterprisegroup.service;

import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.common.BusinessRuleException;
import com.capstone.rebyu.enterprisegroup.dto.EnterpriseGroupAuthorityDto;
import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroup;
import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroupAuthority;
import com.capstone.rebyu.enterprisegroup.mapper.EnterpriseGroupAuthorityMapper;
import com.capstone.rebyu.enterprisegroup.repository.EnterpriseGroupAuthorityRepository;
import com.capstone.rebyu.enterprisegroup.repository.EnterpriseGroupRepository;
import com.capstone.rebyu.organization.entity.EnterpriseMember;
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
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class EnterpriseGroupAuthorityService {

    private final EnterpriseGroupAuthorityRepository enterpriseGroupAuthorityRepository;
    private final EnterpriseGroupRepository enterpriseGroupRepository;
    private final EnterpriseGroupAuthorityMapper enterpriseGroupAuthorityMapper;
    private final UserRepository userRepository;
    private final UserTypeRepository userTypeRepository;
    private final EnterpriseMemberRepository enterpriseMemberRepository;

    @Transactional(readOnly = true)
    public List<EnterpriseGroupAuthorityDto> getAll(Long groupId, Long userId) {
        List<EnterpriseGroupAuthority> authorities;
        if (groupId != null) {
            authorities = enterpriseGroupAuthorityRepository.findByEnterpriseGroup_EnterpriseGroupId(groupId);
        } else if (userId != null) {
            authorities = enterpriseGroupAuthorityRepository.findByUser_UserId(userId);
        } else {
            authorities = enterpriseGroupAuthorityRepository.findAll();
        }
        return authorities.stream().map(enterpriseGroupAuthorityMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    public EnterpriseGroupAuthorityDto getById(Long id) {
        return enterpriseGroupAuthorityMapper.toDto(findEntity(id));
    }

    public EnterpriseGroupAuthorityDto create(EnterpriseGroupAuthorityDto dto, Long callerEnterpriseId) {
        log.info("Assigning authority userId={} to groupId={}", dto.getUserId(), dto.getEnterpriseGroupId());
        EnterpriseGroup group = enterpriseGroupRepository.findById(dto.getEnterpriseGroupId())
                .orElseThrow(() -> new EntityNotFoundException(
                        "EnterpriseGroup not found: " + dto.getEnterpriseGroupId()));

        // Cross-tenant guard: the group must belong to the caller's own enterprise.
        // Reported as "not found" (not a 403) so callers can't probe other tenants' groups.
        if (group.getEnterprise() == null
                || callerEnterpriseId == null
                || !group.getEnterprise().getEnterpriseId().equals(callerEnterpriseId)) {
            throw new EntityNotFoundException("EnterpriseGroup not found: " + dto.getEnterpriseGroupId());
        }

        User user = User.builder().userId(dto.getUserId()).build();
        EnterpriseGroupAuthority entity = enterpriseGroupAuthorityRepository
                .findByEnterpriseGroupAndUser(group, user)
                .map(existing -> reactivate(existing, dto))
                .orElseGet(() -> newAuthority(dto));

        EnterpriseGroupAuthorityDto result =
                enterpriseGroupAuthorityMapper.toDto(enterpriseGroupAuthorityRepository.save(entity));
        promoteToEnterpriseMember(dto.getUserId());
        log.info("Enterprise group authority created with id: {}", result.getEnterpriseGroupAuthorityId());
        return result;
    }

    /**
     * Leading a group makes someone an enterprise member, so their account type
     * is corrected here as well as at provisioning time. Accounts predating the
     * ENTERPRISE_MEMBER role were all created as plain ENTERPRISE, and a leader
     * can also be added from an account that already existed for another
     * reason, so neither path can be relied on to have set it already.
     *
     * The organization's own ENTERPRISE account is deliberately left alone: an
     * owner who also leads a group stays the owner.
     */
    private void promoteToEnterpriseMember(Long userId) {
        if (userId == null) {
            return;
        }
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return;
        }
        String currentType = user.getUserType() != null ? user.getUserType().getUserTypeText() : null;
        if (CognitoAuthService.ENTERPRISE_USER_TYPE.equalsIgnoreCase(currentType)
                && isOrganizationOwnAccount(user)) {
            return;
        }
        if (CognitoAuthService.ENTERPRISE_MEMBER_USER_TYPE.equalsIgnoreCase(currentType)) {
            return;
        }

        UserType memberType = userTypeRepository
                .findByUserTypeText(CognitoAuthService.ENTERPRISE_MEMBER_USER_TYPE)
                .orElseGet(() -> {
                    UserType type = new UserType();
                    type.setUserTypeText(CognitoAuthService.ENTERPRISE_MEMBER_USER_TYPE);
                    return userTypeRepository.save(type);
                });
        user.setUserType(memberType);
        userRepository.save(user);
        log.info("Promoted userId={} to {} on group-authority assignment",
                userId, CognitoAuthService.ENTERPRISE_MEMBER_USER_TYPE);
    }

    /** An owner/primary contact holds the organization's own account. */
    private boolean isOrganizationOwnAccount(User user) {
        return enterpriseMemberRepository.findByUser_UserId(user.getUserId()).stream()
                .anyMatch(member -> member.isPrimaryContact()
                        || member.getMemberRole() == EnterpriseMember.MemberRole.owner);
    }

    /**
     * Re-adding a user who was previously archived as an authority for this group must
     * revive their existing row rather than insert a new one -- the DB now only enforces
     * uniqueness among active rows (uq_enterprise_group_authority_active), so inserting a
     * fresh row here would create a duplicate membership the database no longer blocks.
     */
    private EnterpriseGroupAuthority reactivate(EnterpriseGroupAuthority existing, EnterpriseGroupAuthorityDto dto) {
        if (existing.getStatus() == EnterpriseGroupAuthority.Status.active) {
            throw new BusinessRuleException.EnterpriseGroupRuleException(
                    "This user is already an active authority for this group.");
        }
        existing.setStatus(EnterpriseGroupAuthority.Status.active);
        existing.setAssignedBy(User.builder().userId(dto.getAssignedBy()).build());
        existing.setAssignedAt(dto.getAssignedAt() != null ? dto.getAssignedAt() : LocalDateTime.now());
        existing.setRemovedAt(null);
        return existing;
    }

    private EnterpriseGroupAuthority newAuthority(EnterpriseGroupAuthorityDto dto) {
        EnterpriseGroupAuthority entity = enterpriseGroupAuthorityMapper.toEntity(dto);
        entity.setEnterpriseGroupAuthorityId(null);
        entity.setAssignedAt(dto.getAssignedAt() != null ? dto.getAssignedAt() : LocalDateTime.now());
        entity.setStatus(EnterpriseGroupAuthority.Status.active);
        entity.setRemovedAt(null);
        return entity;
    }

    /** Archive (soft-remove) an authority assignment. */
    public void delete(Long id, Long callerEnterpriseId) {
        log.info("Removing enterprise group authority id: {}", id);
        EnterpriseGroupAuthority entity = findEntity(id);
        requireSameEnterprise(entity, callerEnterpriseId);
        entity.setStatus(EnterpriseGroupAuthority.Status.archived);
        entity.setRemovedAt(LocalDateTime.now());
        enterpriseGroupAuthorityRepository.save(entity);
    }

    private void requireSameEnterprise(EnterpriseGroupAuthority entity, Long callerEnterpriseId) {
        EnterpriseGroup group = entity.getEnterpriseGroup();
        if (group == null || group.getEnterprise() == null
                || !group.getEnterprise().getEnterpriseId().equals(callerEnterpriseId)) {
            throw new EntityNotFoundException(
                    "EnterpriseGroupAuthority not found: " + entity.getEnterpriseGroupAuthorityId());
        }
    }

    private EnterpriseGroupAuthority findEntity(Long id) {
        return enterpriseGroupAuthorityRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("EnterpriseGroupAuthority not found: " + id));
    }
}

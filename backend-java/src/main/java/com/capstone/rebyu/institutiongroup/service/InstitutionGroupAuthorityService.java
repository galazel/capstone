package com.capstone.rebyu.institutiongroup.service;

import com.capstone.rebyu.auth.service.CognitoAuthService;
import com.capstone.rebyu.common.BusinessRuleException;
import com.capstone.rebyu.institutiongroup.dto.InstitutionGroupAuthorityDto;
import com.capstone.rebyu.institutiongroup.entity.InstitutionGroup;
import com.capstone.rebyu.institutiongroup.entity.InstitutionGroupAuthority;
import com.capstone.rebyu.institutiongroup.mapper.InstitutionGroupAuthorityMapper;
import com.capstone.rebyu.institutiongroup.repository.InstitutionGroupAuthorityRepository;
import com.capstone.rebyu.institutiongroup.repository.InstitutionGroupRepository;
import com.capstone.rebyu.organization.entity.InstitutionMember;
import com.capstone.rebyu.organization.repository.InstitutionMemberRepository;
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
public class InstitutionGroupAuthorityService {

    private final InstitutionGroupAuthorityRepository institutionGroupAuthorityRepository;
    private final InstitutionGroupRepository institutionGroupRepository;
    private final InstitutionGroupAuthorityMapper institutionGroupAuthorityMapper;
    private final UserRepository userRepository;
    private final UserTypeRepository userTypeRepository;
    private final InstitutionMemberRepository institutionMemberRepository;

    @Transactional(readOnly = true)
    public List<InstitutionGroupAuthorityDto> getAll(Long groupId, Long userId) {
        List<InstitutionGroupAuthority> authorities;
        if (groupId != null) {
            authorities = institutionGroupAuthorityRepository.findByInstitutionGroup_InstitutionGroupId(groupId);
        } else if (userId != null) {
            authorities = institutionGroupAuthorityRepository.findByUser_UserId(userId);
        } else {
            authorities = institutionGroupAuthorityRepository.findAll();
        }
        return authorities.stream().map(institutionGroupAuthorityMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    public InstitutionGroupAuthorityDto getById(Long id) {
        return institutionGroupAuthorityMapper.toDto(findEntity(id));
    }

    public InstitutionGroupAuthorityDto create(InstitutionGroupAuthorityDto dto, Long callerInstitutionId) {
        log.info("Assigning authority userId={} to groupId={}", dto.getUserId(), dto.getInstitutionGroupId());
        InstitutionGroup group = institutionGroupRepository.findById(dto.getInstitutionGroupId())
                .orElseThrow(() -> new EntityNotFoundException(
                        "InstitutionGroup not found: " + dto.getInstitutionGroupId()));

        // Cross-tenant guard: the group must belong to the caller's own institution.
        // Reported as "not found" (not a 403) so callers can't probe other tenants' groups.
        if (group.getInstitution() == null
                || callerInstitutionId == null
                || !group.getInstitution().getInstitutionId().equals(callerInstitutionId)) {
            throw new EntityNotFoundException("InstitutionGroup not found: " + dto.getInstitutionGroupId());
        }

        User user = User.builder().userId(dto.getUserId()).build();
        InstitutionGroupAuthority entity = institutionGroupAuthorityRepository
                .findByInstitutionGroupAndUser(group, user)
                .map(existing -> reactivate(existing, dto))
                .orElseGet(() -> newAuthority(dto));

        InstitutionGroupAuthorityDto result =
                institutionGroupAuthorityMapper.toDto(institutionGroupAuthorityRepository.save(entity));
        promoteToInstitutionMember(dto.getUserId());
        log.info("Institution group authority created with id: {}", result.getInstitutionGroupAuthorityId());
        return result;
    }

    /**
     * Leading a group makes someone an institution member, so their account type
     * is corrected here as well as at provisioning time. Accounts predating the
     * INSTITUTION_MEMBER role were all created as plain INSTITUTION, and a leader
     * can also be added from an account that already existed for another
     * reason, so neither path can be relied on to have set it already.
     *
     * The organization's own INSTITUTION account is deliberately left alone: an
     * owner who also leads a group stays the owner.
     */
    private void promoteToInstitutionMember(Long userId) {
        if (userId == null) {
            return;
        }
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return;
        }
        String currentType = user.getUserType() != null ? user.getUserType().getUserTypeText() : null;
        if (CognitoAuthService.INSTITUTION_USER_TYPE.equalsIgnoreCase(currentType)
                && isOrganizationOwnAccount(user)) {
            return;
        }
        if (CognitoAuthService.INSTITUTION_MEMBER_USER_TYPE.equalsIgnoreCase(currentType)) {
            return;
        }

        UserType memberType = userTypeRepository
                .findByUserTypeText(CognitoAuthService.INSTITUTION_MEMBER_USER_TYPE)
                .orElseGet(() -> {
                    UserType type = new UserType();
                    type.setUserTypeText(CognitoAuthService.INSTITUTION_MEMBER_USER_TYPE);
                    return userTypeRepository.save(type);
                });
        user.setUserType(memberType);
        userRepository.save(user);
        log.info("Promoted userId={} to {} on group-authority assignment",
                userId, CognitoAuthService.INSTITUTION_MEMBER_USER_TYPE);
    }

    /** An owner/primary contact holds the organization's own account. */
    private boolean isOrganizationOwnAccount(User user) {
        return institutionMemberRepository.findByUser_UserId(user.getUserId()).stream()
                .anyMatch(member -> member.isPrimaryContact()
                        || member.getMemberRole() == InstitutionMember.MemberRole.owner);
    }

    /**
     * Re-adding a user who was previously archived as an authority for this group must
     * revive their existing row rather than insert a new one -- the DB now only enforces
     * uniqueness among active rows (uq_institution_group_authority_active), so inserting a
     * fresh row here would create a duplicate membership the database no longer blocks.
     */
    private InstitutionGroupAuthority reactivate(InstitutionGroupAuthority existing, InstitutionGroupAuthorityDto dto) {
        if (existing.getStatus() == InstitutionGroupAuthority.Status.active) {
            throw new BusinessRuleException.InstitutionGroupRuleException(
                    "This user is already an active authority for this group.");
        }
        existing.setStatus(InstitutionGroupAuthority.Status.active);
        existing.setAssignedBy(User.builder().userId(dto.getAssignedBy()).build());
        existing.setAssignedAt(dto.getAssignedAt() != null ? dto.getAssignedAt() : LocalDateTime.now());
        existing.setRemovedAt(null);
        return existing;
    }

    private InstitutionGroupAuthority newAuthority(InstitutionGroupAuthorityDto dto) {
        InstitutionGroupAuthority entity = institutionGroupAuthorityMapper.toEntity(dto);
        entity.setInstitutionGroupAuthorityId(null);
        entity.setAssignedAt(dto.getAssignedAt() != null ? dto.getAssignedAt() : LocalDateTime.now());
        entity.setStatus(InstitutionGroupAuthority.Status.active);
        entity.setRemovedAt(null);
        return entity;
    }

    /** Archive (soft-remove) an authority assignment. */
    public void delete(Long id, Long callerInstitutionId) {
        log.info("Removing institution group authority id: {}", id);
        InstitutionGroupAuthority entity = findEntity(id);
        requireSameInstitution(entity, callerInstitutionId);
        entity.setStatus(InstitutionGroupAuthority.Status.archived);
        entity.setRemovedAt(LocalDateTime.now());
        institutionGroupAuthorityRepository.save(entity);
    }

    private void requireSameInstitution(InstitutionGroupAuthority entity, Long callerInstitutionId) {
        InstitutionGroup group = entity.getInstitutionGroup();
        if (group == null || group.getInstitution() == null
                || !group.getInstitution().getInstitutionId().equals(callerInstitutionId)) {
            throw new EntityNotFoundException(
                    "InstitutionGroupAuthority not found: " + entity.getInstitutionGroupAuthorityId());
        }
    }

    private InstitutionGroupAuthority findEntity(Long id) {
        return institutionGroupAuthorityRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("InstitutionGroupAuthority not found: " + id));
    }
}

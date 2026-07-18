package com.capstone.rebyu.organization.mapper;

import com.capstone.rebyu.organization.dto.EnterpriseMemberDto;
import com.capstone.rebyu.organization.entity.EnterpriseMember;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface EnterpriseMemberMapper {
    @Mapping(source = "enterprise.enterpriseId", target = "enterpriseId")
    @Mapping(source = "user.userId", target = "userId")
    @Mapping(source = "user.email", target = "email")
    EnterpriseMemberDto toDto(EnterpriseMember entity);

    @Mapping(source = "enterpriseId", target = "enterprise.enterpriseId")
    @Mapping(source = "userId", target = "user.userId")
    EnterpriseMember toEntity(EnterpriseMemberDto dto);
}

package com.capstone.rebyu.institutiongroup.mapper;

import com.capstone.rebyu.institutiongroup.dto.InstitutionGroupAuthorityDto;
import com.capstone.rebyu.institutiongroup.entity.InstitutionGroupAuthority;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface InstitutionGroupAuthorityMapper {
    @Mapping(source = "institutionGroup.institutionGroupId", target = "institutionGroupId")
    @Mapping(source = "user.userId", target = "userId")
    @Mapping(source = "assignedBy.userId", target = "assignedBy")
    InstitutionGroupAuthorityDto toDto(InstitutionGroupAuthority entity);

    @Mapping(source = "institutionGroupId", target = "institutionGroup.institutionGroupId")
    @Mapping(source = "userId", target = "user.userId")
    @Mapping(source = "assignedBy", target = "assignedBy.userId")
    InstitutionGroupAuthority toEntity(InstitutionGroupAuthorityDto dto);
}

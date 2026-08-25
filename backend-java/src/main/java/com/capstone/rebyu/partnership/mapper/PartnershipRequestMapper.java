package com.capstone.rebyu.partnership.mapper;


import com.capstone.rebyu.organization.entity.Institution;
import com.capstone.rebyu.partnership.dto.PartnershipRequestDto;
import com.capstone.rebyu.partnership.entity.PartnershipRequest;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface PartnershipRequestMapper {
    @Mapping(source = "institution.institutionId", target = "institutionId")
    PartnershipRequestDto toDto(PartnershipRequest entity);

    @Mapping(source = "institutionId", target = "institution.institutionId")
    PartnershipRequest toEntity(PartnershipRequestDto dto);
}

package com.capstone.rebyu.partnership.mapper;

import com.capstone.rebyu.partnership.dto.InstitutionCertificationRenewalRequestDto;
import com.capstone.rebyu.partnership.entity.InstitutionCertificationRenewalRequest;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface InstitutionCertificationRenewalRequestMapper {
    @Mapping(source = "orgCert.orgCertId", target = "orgCertId")
    InstitutionCertificationRenewalRequestDto toDto(InstitutionCertificationRenewalRequest entity);

    @Mapping(source = "orgCertId", target = "orgCert.orgCertId")
    InstitutionCertificationRenewalRequest toEntity(InstitutionCertificationRenewalRequestDto dto);
}

package com.capstone.rebyu.enterprisegroup.mapper;

import com.capstone.rebyu.enterprisegroup.dto.EnterpriseGroupDto;
import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroup;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface EnterpriseGroupMapper {
    @Mapping(source = "enterprise.enterpriseId", target = "enterpriseId")
    @Mapping(source = "orgCert.orgCertId", target = "orgCertId")
    @Mapping(source = "orgCert.certification.certificationId", target = "certificationId")
    @Mapping(source = "createdBy.userId", target = "createdBy")
    EnterpriseGroupDto toDto(EnterpriseGroup entity);

    @Mapping(source = "enterpriseId", target = "enterprise.enterpriseId")
    @Mapping(source = "orgCertId", target = "orgCert.orgCertId")
    @Mapping(target = "orgCert.certification", ignore = true)
    @Mapping(source = "createdBy", target = "createdBy.userId")
    EnterpriseGroup toEntity(EnterpriseGroupDto dto);
}

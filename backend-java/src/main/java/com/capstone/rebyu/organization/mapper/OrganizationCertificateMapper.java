package com.capstone.rebyu.organization.mapper;



import com.capstone.rebyu.organization.entity.Institution;
import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.organization.dto.OrganizationCertificateDto;
import com.capstone.rebyu.organization.entity.OrganizationCertificate;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface OrganizationCertificateMapper {
    @Mapping(source = "institution.institutionId", target = "institutionId")
    @Mapping(source = "certification.certificationId", target = "certificationId")
    OrganizationCertificateDto toDto(OrganizationCertificate entity);

    @Mapping(source = "institutionId", target = "institution.institutionId")
    @Mapping(source = "certificationId", target = "certification.certificationId")
    OrganizationCertificate toEntity(OrganizationCertificateDto dto);
}

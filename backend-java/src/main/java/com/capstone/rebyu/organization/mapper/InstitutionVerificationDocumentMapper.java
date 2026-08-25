package com.capstone.rebyu.organization.mapper;

import com.capstone.rebyu.organization.dto.InstitutionVerificationDocumentDto;
import com.capstone.rebyu.organization.entity.InstitutionVerificationDocument;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface InstitutionVerificationDocumentMapper {
    @Mapping(source = "institution.institutionId", target = "institutionId")
    InstitutionVerificationDocumentDto toDto(InstitutionVerificationDocument entity);

    @Mapping(source = "institutionId", target = "institution.institutionId")
    InstitutionVerificationDocument toEntity(InstitutionVerificationDocumentDto dto);
}

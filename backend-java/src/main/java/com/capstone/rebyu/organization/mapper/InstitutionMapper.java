package com.capstone.rebyu.organization.mapper;

import com.capstone.rebyu.organization.dto.InstitutionDto;
import com.capstone.rebyu.organization.entity.Institution;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface InstitutionMapper {
    InstitutionDto toDto(Institution entity);

    Institution toEntity(InstitutionDto dto);
}

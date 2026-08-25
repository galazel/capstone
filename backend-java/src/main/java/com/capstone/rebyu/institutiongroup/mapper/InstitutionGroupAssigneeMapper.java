package com.capstone.rebyu.institutiongroup.mapper;

import com.capstone.rebyu.institutiongroup.dto.InstitutionGroupAssigneeDto;
import com.capstone.rebyu.institutiongroup.entity.InstitutionGroupAssignee;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface InstitutionGroupAssigneeMapper {
    @Mapping(source = "institutionGroup.institutionGroupId", target = "institutionGroupId")
    @Mapping(source = "orgCertLearner.orgCertLearnerId", target = "orgCertLearnerId")
    @Mapping(source = "orgCertLearner.orgCert.orgCertId", target = "orgCertId")
    @Mapping(source = "orgCertLearner.learner.learnerId", target = "learnerId")
    @Mapping(source = "assignedBy.userId", target = "assignedBy")
    InstitutionGroupAssigneeDto toDto(InstitutionGroupAssignee entity);

    @Mapping(source = "institutionGroupId", target = "institutionGroup.institutionGroupId")
    @Mapping(source = "orgCertLearnerId", target = "orgCertLearner.orgCertLearnerId")
    @Mapping(source = "assignedBy", target = "assignedBy.userId")
    InstitutionGroupAssignee toEntity(InstitutionGroupAssigneeDto dto);
}

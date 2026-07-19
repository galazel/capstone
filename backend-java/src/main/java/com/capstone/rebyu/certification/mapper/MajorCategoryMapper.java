package com.capstone.rebyu.certification.mapper;


import com.capstone.rebyu.certification.entity.Certification;
import com.capstone.rebyu.certification.dto.MajorCategoryDto;
import com.capstone.rebyu.certification.entity.MajorCategory;
import com.capstone.rebyu.certification.entity.MiddleCategory;
import org.mapstruct.AfterMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

@Mapper(componentModel = "spring", uses = MiddleCategoryMapper.class)
public interface MajorCategoryMapper {
    @Mapping(source = "certification.certificationId", target = "certificationId")
    @Mapping(source = "ownerGroup.enterpriseGroupId", target = "ownerGroupId")
    MajorCategoryDto toDto(MajorCategory entity);

    // ownerGroup is never client-settable through this DTO -- it's assigned
    // exclusively by the (not yet built) member-content creation path.
    @Mapping(source = "certificationId", target = "certification.certificationId")
    @Mapping(target = "ownerGroup", ignore = true)
    MajorCategory toEntity(MajorCategoryDto dto);

    @AfterMapping
    default void linkMiddleCategory(@MappingTarget MajorCategory majorCategory){
        if(majorCategory.getMiddleCategory() != null){
            for(MiddleCategory middleCategory : majorCategory.getMiddleCategory()){
                middleCategory.setMajorCategory(majorCategory);
            }
        }
    }
}

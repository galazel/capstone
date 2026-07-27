package com.capstone.rebyu.aigateway.mapper;

import com.capstone.rebyu.aigateway.dto.KnowledgeDocumentDto;
import com.capstone.rebyu.aigateway.entity.KnowledgeDocument;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface KnowledgeDocumentMapper {

    @Mapping(target = "status", expression = "java(entity.getStatus().name())")
    @Mapping(target = "useCase", expression = "java(entity.getUseCase().name())")
    KnowledgeDocumentDto toDto(KnowledgeDocument entity);
}

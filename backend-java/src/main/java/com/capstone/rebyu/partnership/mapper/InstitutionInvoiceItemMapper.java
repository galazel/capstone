package com.capstone.rebyu.partnership.mapper;

import com.capstone.rebyu.partnership.dto.InstitutionInvoiceItemDto;
import com.capstone.rebyu.partnership.entity.InstitutionInvoiceItem;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface InstitutionInvoiceItemMapper {
    @Mapping(source = "institutionInvoice.institutionInvoiceId", target = "institutionInvoiceId")
    @Mapping(source = "certification.certificationId", target = "certificationId")
    InstitutionInvoiceItemDto toDto(InstitutionInvoiceItem entity);

    @Mapping(source = "institutionInvoiceId", target = "institutionInvoice.institutionInvoiceId")
    @Mapping(source = "certificationId", target = "certification.certificationId")
    InstitutionInvoiceItem toEntity(InstitutionInvoiceItemDto dto);
}

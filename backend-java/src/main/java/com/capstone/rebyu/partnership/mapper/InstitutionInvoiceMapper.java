package com.capstone.rebyu.partnership.mapper;

import com.capstone.rebyu.partnership.dto.InstitutionInvoiceDto;
import com.capstone.rebyu.partnership.entity.InstitutionInvoice;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface InstitutionInvoiceMapper {
    @Mapping(source = "institution.institutionId", target = "institutionId")
    @Mapping(source = "partnershipRequest.requestId", target = "partnershipRequestId")
    @Mapping(source = "renewalRequest.renewalRequestId", target = "renewalRequestId")
    @Mapping(source = "verifiedByUser.userId", target = "verifiedByUserId")
    InstitutionInvoiceDto toDto(InstitutionInvoice entity);

    @Mapping(source = "institutionId", target = "institution.institutionId")
    @Mapping(source = "partnershipRequestId", target = "partnershipRequest.requestId")
    @Mapping(source = "renewalRequestId", target = "renewalRequest.renewalRequestId")
    @Mapping(source = "verifiedByUserId", target = "verifiedByUser.userId")
    InstitutionInvoice toEntity(InstitutionInvoiceDto dto);
}

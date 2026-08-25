package com.capstone.rebyu.partnership.controller;

import com.capstone.rebyu.partnership.dto.InstitutionCertificationRenewalRequestDto;
import com.capstone.rebyu.partnership.service.InstitutionCertificationRenewalRequestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/institution-certification-renewal-requests")
@RequiredArgsConstructor
public class InstitutionCertificationRenewalRequestController {
    private final InstitutionCertificationRenewalRequestService renewalRequestService;

    @GetMapping
    public List<InstitutionCertificationRenewalRequestDto> getAll() {
        return renewalRequestService.getAll();
    }

    @GetMapping("/org-cert/{orgCertId}")
    public List<InstitutionCertificationRenewalRequestDto> getByOrgCertId(@PathVariable Long orgCertId) {
        return renewalRequestService.getByOrgCertId(orgCertId);
    }

    @GetMapping("/{id}")
    public InstitutionCertificationRenewalRequestDto getById(@PathVariable Long id) {
        return renewalRequestService.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public InstitutionCertificationRenewalRequestDto create(@Valid @RequestBody InstitutionCertificationRenewalRequestDto dto) {
        return renewalRequestService.create(dto);
    }

    @PutMapping("/{id}")
    public InstitutionCertificationRenewalRequestDto update(@PathVariable Long id,
                                                           @Valid @RequestBody InstitutionCertificationRenewalRequestDto dto) {
        return renewalRequestService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        renewalRequestService.delete(id);
    }
}

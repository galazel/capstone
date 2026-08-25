package com.capstone.rebyu.partnership.controller;

import com.capstone.rebyu.partnership.dto.InstitutionInvoiceItemDto;
import com.capstone.rebyu.partnership.service.InstitutionInvoiceItemService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/institution-invoice-items")
@RequiredArgsConstructor
public class InstitutionInvoiceItemController {
    private final InstitutionInvoiceItemService service;

    @GetMapping
    public List<InstitutionInvoiceItemDto> getAll() {
        return service.getAll();
    }

    @GetMapping("/{id}")
    public InstitutionInvoiceItemDto getById(@PathVariable Long id) {
        return service.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public InstitutionInvoiceItemDto create(@Valid @RequestBody InstitutionInvoiceItemDto dto) {
        return service.create(dto);
    }

    @PutMapping("/{id}")
    public InstitutionInvoiceItemDto update(@PathVariable Long id, @Valid @RequestBody InstitutionInvoiceItemDto dto) {
        return service.update(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}

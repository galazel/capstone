package com.capstone.rebyu.partnership.repository;

import com.capstone.rebyu.partnership.entity.InstitutionInvoice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InstitutionInvoiceRepository extends JpaRepository<InstitutionInvoice, Long> {

    /** All invoices for one institution — the tenant-scoped portal view. */
    List<InstitutionInvoice> findByInstitution_InstitutionId(Long institutionId);
}

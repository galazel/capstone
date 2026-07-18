package com.capstone.rebyu.partnership.repository;

import com.capstone.rebyu.partnership.entity.EnterpriseInvoice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EnterpriseInvoiceRepository extends JpaRepository<EnterpriseInvoice, Long> {

    /** All invoices for one enterprise — the tenant-scoped portal view. */
    List<EnterpriseInvoice> findByEnterprise_EnterpriseId(Long enterpriseId);
}

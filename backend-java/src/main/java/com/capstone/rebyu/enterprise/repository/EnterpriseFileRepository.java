package com.capstone.rebyu.enterprise.repository;

import com.capstone.rebyu.enterprise.entity.EnterpriseFile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EnterpriseFileRepository extends JpaRepository<EnterpriseFile, Long> {

    List<EnterpriseFile> findByEnterprise_EnterpriseIdOrderByCreatedAtDesc(Long enterpriseId);

    Optional<EnterpriseFile> findByEnterpriseFileIdAndEnterprise_EnterpriseId(Long enterpriseFileId, Long enterpriseId);
}

package com.capstone.rebyu.organization.repository;

import com.capstone.rebyu.organization.entity.Institution;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface InstitutionRepository extends JpaRepository<Institution, Long> {

    Optional<Institution> findByPrimaryContactEmailIgnoreCase(String email);

    Optional<Institution> findByInstitutionNameIgnoreCase(String institutionName);
}

package com.capstone.rebyu.organization.repository;

import com.capstone.rebyu.organization.entity.Organization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface OrganizationRepository extends JpaRepository<Organization, Long> {
  Optional<Organization> findByDomain(String domain);
  java.util.List<Organization> findByIsActiveTrueOrderByCreatedAtDesc();
}

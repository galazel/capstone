package com.capstone.rebyu.institution.repository;

import com.capstone.rebyu.institution.entity.InstitutionFile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InstitutionFileRepository extends JpaRepository<InstitutionFile, Long> {

    List<InstitutionFile> findByInstitution_InstitutionIdOrderByCreatedAtDesc(Long institutionId);

    Optional<InstitutionFile> findByInstitutionFileIdAndInstitution_InstitutionId(Long institutionFileId, Long institutionId);
}

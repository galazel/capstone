package com.capstone.rebyu.certification.repository;

import com.capstone.rebyu.certification.entity.Certification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CertificationRepository extends JpaRepository<Certification, Long> {

    @Query("""
            SELECT c FROM Certification c
            WHERE c.certificationId = :id
            """)
    Optional<Certification> findByIdWithFullTree(@Param("id") Long id);

    long countByStatus(Certification.CertificationStatus status);
}

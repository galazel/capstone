package com.capstone.rebyu.assessment.repository;

import com.capstone.rebyu.assessment.entity.ExamType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ExamTypeRepository extends JpaRepository<ExamType, Long> {
    Optional<ExamType> findByExamTypeText(String examTypeText);
}

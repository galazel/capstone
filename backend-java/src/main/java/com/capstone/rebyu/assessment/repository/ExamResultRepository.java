package com.capstone.rebyu.assessment.repository;

import com.capstone.rebyu.assessment.entity.ExamResult;
import com.capstone.rebyu.assessment.entity.ExamResultId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExamResultRepository extends JpaRepository<ExamResult, ExamResultId> {

    List<ExamResult> findByLearner_LearnerId(Long learnerId);
}

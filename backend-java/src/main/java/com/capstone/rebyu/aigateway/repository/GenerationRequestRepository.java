package com.capstone.rebyu.aigateway.repository;

import com.capstone.rebyu.aigateway.entity.GenerationRequest;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GenerationRequestRepository extends JpaRepository<GenerationRequest, Long> {
}

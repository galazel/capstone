package com.capstone.rebyu.bkt.repository;

import com.capstone.rebyu.bkt.entity.BKTModel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface BKTModelRepository extends JpaRepository<BKTModel, Long> {
  Optional<BKTModel> findByLearner_LearnerIdAndCertification_CertificationId(Long learnerId, Long certificationId);
  List<BKTModel> findByLearner_LearnerId(Long learnerId);
  List<BKTModel> findByLearner_LearnerIdOrderByMasteryLevelDesc(Long learnerId);
}

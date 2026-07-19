package com.capstone.rebyu.organization.repository;

import com.capstone.rebyu.organization.entity.TeamMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface TeamMemberRepository extends JpaRepository<TeamMember, Long> {
  List<TeamMember> findByOrganization_OrgIdOrderByLearner_LearnerId(Long orgId);
  java.util.Optional<TeamMember> findByOrganization_OrgIdAndLearner_LearnerId(Long orgId, Long learnerId);
}

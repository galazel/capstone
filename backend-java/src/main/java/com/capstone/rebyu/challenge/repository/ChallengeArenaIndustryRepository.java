package com.capstone.rebyu.challenge.repository;

import com.capstone.rebyu.challenge.entity.ChallengeArenaIndustry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChallengeArenaIndustryRepository
    extends JpaRepository<ChallengeArenaIndustry, Long> {

  List<ChallengeArenaIndustry> findByArenaIdOrderByIndustryAsc(String arenaId);

  void deleteByArenaId(String arenaId);
}

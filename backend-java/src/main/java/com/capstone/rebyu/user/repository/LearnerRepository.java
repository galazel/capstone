package com.capstone.rebyu.user.repository;

import com.capstone.rebyu.user.entity.Learner;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface LearnerRepository extends JpaRepository<Learner, Long> {

    Optional<Learner> findByUser_UserId(Long userId);

    java.util.List<Learner> findByLearnerIdIn(java.util.Collection<Long> learnerIds);

    boolean existsByUsername(String username);

    // Learner has no email of its own -- email lives on the linked User.
    Optional<Learner> findByUser_EmailIgnoreCase(String email);
}

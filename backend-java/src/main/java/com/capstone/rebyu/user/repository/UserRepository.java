package com.capstone.rebyu.user.repository;

import com.capstone.rebyu.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByCognitoSub(String cognitoSub);

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    List<User> findByUserType_UserTypeText(String userTypeText);

    long countByAccountStatus(User.AccountStatus accountStatus);

    long countByUserType_UserTypeText(String userTypeText);
}

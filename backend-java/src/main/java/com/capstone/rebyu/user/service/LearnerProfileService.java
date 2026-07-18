package com.capstone.rebyu.user.service;

import com.capstone.rebyu.user.dto.LearnerDto;
import com.capstone.rebyu.user.entity.Learner;
import com.capstone.rebyu.user.entity.User;
import com.capstone.rebyu.user.mapper.LearnerMapper;
import com.capstone.rebyu.user.repository.LearnerRepository;
import com.capstone.rebyu.user.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.regex.Pattern;

/**
 * Learner profile management: update personal info, change password.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class LearnerProfileService {

    private final LearnerRepository learnerRepository;
    private final UserRepository userRepository;
    private final LearnerMapper learnerMapper;
    private final PasswordEncoder passwordEncoder;

    private static final Pattern EMAIL_PATTERN = Pattern.compile(
            "^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$"
    );

    /**
     * Update learner profile (first name, last name, email).
     */
    public LearnerDto updateProfile(Long learnerId, String firstName, String lastName, String email) {
        Learner learner = learnerRepository.findById(learnerId)
                .orElseThrow(() -> new EntityNotFoundException("Learner not found: " + learnerId));

        User user = learner.getUser();
        if (user == null) {
            throw new IllegalStateException("Learner has no associated user account");
        }

        // Validate email format
        if (email != null && !email.isBlank()) {
            if (!EMAIL_PATTERN.matcher(email).matches()) {
                throw new IllegalArgumentException("Invalid email format");
            }

            // Check if email is already in use by another user
            if (!email.equalsIgnoreCase(user.getEmail())) {
                boolean emailExists = userRepository.existsByEmailIgnoreCase(email);
                if (emailExists) {
                    throw new IllegalArgumentException("Email is already in use");
                }
            }

            user.setEmail(email);
        }

        // Update learner profile
        if (firstName != null && !firstName.isBlank()) {
            learner.setFirstName(firstName.trim());
        }
        if (lastName != null && !lastName.isBlank()) {
            learner.setLastName(lastName.trim());
        }

        userRepository.save(user);
        learnerRepository.save(learner);

        log.info("Profile updated for learner: {}", learnerId);
        return learnerMapper.toDto(learner);
    }

    /**
     * Change password with old password verification.
     */
    public void changePassword(Long learnerId, String oldPassword, String newPassword) {
        Learner learner = learnerRepository.findById(learnerId)
                .orElseThrow(() -> new EntityNotFoundException("Learner not found: " + learnerId));

        User user = learner.getUser();
        if (user == null) {
            throw new IllegalStateException("Learner has no associated user account");
        }

        // Verify old password
        if (!passwordEncoder.matches(oldPassword, user.getPassword())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }

        // Validate new password
        if (newPassword == null || newPassword.length() < 8) {
            throw new IllegalArgumentException("New password must be at least 8 characters long");
        }

        if (newPassword.equals(oldPassword)) {
            throw new IllegalArgumentException("New password must be different from current password");
        }

        // Update password
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        log.info("Password changed for learner: {}", learnerId);
    }

    /**
     * Delete account (mark as inactive).
     */
    public void deleteAccount(Long learnerId, String password) {
        Learner learner = learnerRepository.findById(learnerId)
                .orElseThrow(() -> new EntityNotFoundException("Learner not found: " + learnerId));

        User user = learner.getUser();
        if (user == null) {
            throw new IllegalStateException("Learner has no associated user account");
        }

        // Verify password
        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new IllegalArgumentException("Password is incorrect");
        }

        // Mark account as inactive instead of deleting
        user.setActive(false);
        learner.setActive(false);
        userRepository.save(user);
        learnerRepository.save(learner);

        log.info("Account deleted for learner: {}", learnerId);
    }
}

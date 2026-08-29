package com.capstone.rebyu.user.service;

import com.capstone.rebyu.user.dto.UserDto;
import com.capstone.rebyu.user.mapper.UserMapper;
import com.capstone.rebyu.user.entity.User;
import com.capstone.rebyu.user.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class UserService {
    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final AccountDeletionService accountDeletionService;

    public List<UserDto> getAll() {
        return userRepository.findAll().stream().map(userMapper::toDto).toList();
    }

    public UserDto getById(Long id) {
        return userMapper.toDto(findEntity(id));
    }

    public UserDto create(UserDto dto) {
        User entity = userMapper.toEntity(dto);
        entity.setUserId(null);
        return userMapper.toDto(userRepository.save(entity));
    }

    public UserDto update(Long id, UserDto dto) {
        findEntity(id);
        User entity = userMapper.toEntity(dto);
        entity.setUserId(id);
        return userMapper.toDto(userRepository.save(entity));
    }

    /**
     * Deleting a user erases the whole account -- the learner profile behind it,
     * their enrolments, attempts, achievements, posts, files, BKT mastery and
     * Cognito sign-in -- rather than just the row. See AccountDeletionService.
     */
    public void delete(Long id) {
        findEntity(id); // 404 for an unknown id, before anything is removed
        accountDeletionService.deleteUser(id);
    }

    private User findEntity(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + id));
    }
}

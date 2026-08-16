package com.capstone.rebyu.progress.controller;

import com.capstone.rebyu.progress.dto.LearnerCompletedLessonDto;
import com.capstone.rebyu.progress.service.LearnerCompletedLessonService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/learner-completed-lessons")
@RequiredArgsConstructor
public class LearnerCompletedLessonController {
    private final LearnerCompletedLessonService learnerCompletedLessonService;

    @GetMapping
    public List<LearnerCompletedLessonDto> getAll() {
        return learnerCompletedLessonService.getAll();
    }
    @GetMapping("/{learnerId}/{lessonId}")
    public LearnerCompletedLessonDto getById(@PathVariable Long learnerId, @PathVariable Long lessonId) {
        return learnerCompletedLessonService.getById(learnerId, lessonId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LearnerCompletedLessonDto create(@Valid @RequestBody LearnerCompletedLessonDto dto) {
        return learnerCompletedLessonService.create(dto);
    }

    @PutMapping("/{learnerId}/{lessonId}")
    public LearnerCompletedLessonDto update(@PathVariable Long learnerId, @PathVariable Long lessonId,
                                             @Valid @RequestBody LearnerCompletedLessonDto dto) {
        return learnerCompletedLessonService.update(learnerId, lessonId, dto);
    }

    @DeleteMapping("/{learnerId}/{lessonId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long learnerId, @PathVariable Long lessonId) {
        learnerCompletedLessonService.delete(learnerId, lessonId);
    }
}

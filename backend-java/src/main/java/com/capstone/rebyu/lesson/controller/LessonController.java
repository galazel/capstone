package com.capstone.rebyu.lesson.controller;

import com.capstone.rebyu.auth.dto.CurrentUserDto;
import com.capstone.rebyu.lesson.service.LessonService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.preauthorize.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/lessons")
public class LessonController {

  @Autowired
  private LessonService lessonService;

  @PostMapping("/{lessonId}/complete")
  @PreAuthorize("hasRole('LEARNER')")
  public ResponseEntity<?> completeLesson(
      @PathVariable Long lessonId,
      @RequestAttribute CurrentUserDto currentUser) {
    lessonService.completeLesson(lessonId, currentUser.getLearnerId());
    return ResponseEntity.ok().build();
  }
}

package com.capstone.rebyu.lesson.service;

import com.capstone.rebyu.lesson.entity.Lesson;
import com.capstone.rebyu.lesson.repository.LessonRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LessonService {

  @Autowired
  private LessonRepository lessonRepository;

  @Transactional
  public void completeLesson(Long lessonId, Long learnerId) {
    Lesson lesson = lessonRepository.findById(lessonId).orElseThrow();
    lesson.setCompletedAt(java.time.LocalDateTime.now());
    lesson.setIsActive(true);
    lessonRepository.save(lesson);
  }
}

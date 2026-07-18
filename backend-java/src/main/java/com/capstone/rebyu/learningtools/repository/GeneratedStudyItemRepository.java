package com.capstone.rebyu.learningtools.repository;

import com.capstone.rebyu.learningtools.entity.GeneratedStudyItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GeneratedStudyItemRepository extends JpaRepository<GeneratedStudyItem, Long> {

    List<GeneratedStudyItem> findByStudySet_StudySetIdOrderByDisplayOrder(Long studySetId);

    Optional<GeneratedStudyItem> findByStudyItemIdAndStudySet_StudySetId(Long studyItemId, Long studySetId);
}

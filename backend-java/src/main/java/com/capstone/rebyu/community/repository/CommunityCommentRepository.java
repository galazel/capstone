package com.capstone.rebyu.community.repository;

import com.capstone.rebyu.community.entity.CommunityComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CommunityCommentRepository extends JpaRepository<CommunityComment, Long> {

    @Query("""
            SELECT c
            FROM CommunityComment c
            JOIN FETCH c.author
            JOIN FETCH c.post
            LEFT JOIN FETCH c.parentComment
            WHERE c.post.postId = :postId
            ORDER BY c.createdAt ASC
            """)
    List<CommunityComment> findByPostIdWithAuthors(@Param("postId") Long postId);

    long countByPost_PostId(Long postId);
}

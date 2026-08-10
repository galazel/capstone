package com.capstone.rebyu.community.repository;

import java.time.Instant;

/** Spring Data interface projection for the community feed's aggregate native query. */
public interface CommunityPostRow {
    Long getPostId();
    String getAuthorName();
    String getCommunity();
    /**
     * Instant, not OffsetDateTime: Hibernate hands a native query's timestamptz back as
     * an Instant, and the projection proxy converts nothing it has no converter for --
     * declaring OffsetDateTime here fails at runtime the moment the feed has a row.
     */
    Instant getCreatedAt();
    String getTitle();
    String getBody();
    String getPostType();
    Long getCircleId();
    String getAttachmentName();
    String getAttachmentType();
    String getAttachmentKey();
    Long getAttachmentSize();
    long getReactions();
    long getComments();
    long getSaves();
    boolean getLiked();
    boolean getSaved();
    boolean getOwnedByMe();
}

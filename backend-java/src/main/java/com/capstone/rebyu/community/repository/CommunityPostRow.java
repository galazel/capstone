package com.capstone.rebyu.community.repository;

import java.time.OffsetDateTime;

/** Spring Data interface projection for the community feed's aggregate native query. */
public interface CommunityPostRow {
    Long getPostId();
    String getAuthorName();
    String getCommunity();
    OffsetDateTime getCreatedAt();
    String getTitle();
    String getBody();
    String getPostType();
    Long getCircleId();
    String getAttachmentName();
    String getAttachmentType();
    String getAttachmentKey();
    long getReactions();
    long getComments();
    boolean getLiked();
    boolean getSaved();
    boolean getOwnedByMe();
}

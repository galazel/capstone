package com.capstone.rebyu.community.repository;

/** Spring Data interface projection for the study-circle list's aggregate native query. */
public interface CommunityCircleRow {
    Long getCircleId();
    String getName();
    String getDescription();
    String getTopic();
    long getMembers();
    boolean getJoined();
    boolean getOwner();
}

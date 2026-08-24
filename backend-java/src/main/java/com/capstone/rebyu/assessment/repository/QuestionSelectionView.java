package com.capstone.rebyu.assessment.repository;

/**
 * The parts of a {@code Question} that question-selection algorithms actually
 * read, fetched as a flat projection instead of a managed entity.
 *
 * <p>Loading {@code Question} entities in bulk is disproportionately expensive.
 * {@code Question} owns three inverse-side {@code @OneToOne} configs (diagram,
 * programming, text). {@code @OneToOne} defaults to EAGER, and Hibernate cannot
 * hand back a proxy for an inverse-side one-to-one -- with no foreign key on
 * this side of the row it has no way to know whether the association is null
 * without going to look. So every entity loaded costs three extra SELECTs,
 * whether or not anything ever touches those configs.
 *
 * <p>That is invisible on a handful of rows and ruinous on a whole
 * certification's question bank: resolving a scope of N questions cost 1 + 3N
 * round trips. Against a remote database that is the difference between a page
 * that loads and one that appears to hang. A projection never materializes an
 * entity, so none of it fires -- the scan is one query flat, and only the
 * questions actually chosen are loaded as entities.
 */
public interface QuestionSelectionView {

    Long getQuestionId();

    Long getLessonId();

    String getDifficultyLevel();

    /** Used to detect questions duplicated across ids; see the selector's stem matching. */
    String getQuestionText();

    /** Null for official, platform-wide questions. */
    Long getOwnerGroupId();
}

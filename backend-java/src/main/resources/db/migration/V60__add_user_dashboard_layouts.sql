-- Dashboard arrangements for boards that are not the learner analytics page.
--
-- learner_dashboard_layouts is keyed on learner_id, so it can only ever store the
-- learner board: an admin or an institution manager has no learner row, and the
-- study-desk endpoint that reads it rejects them outright. The admin and
-- institution dashboards need the same drag-to-arrange behaviour, so the layout is
-- keyed on the user instead, with a board name alongside it -- one person can hold
-- an arrangement per board, and a board added later needs no schema change.
--
-- Deliberately a separate table rather than a widening of the learner one: that
-- table's UNIQUE(learner_id) is what guarantees one learner has one analytics
-- board, and relaxing it to (learner_id, board) to accommodate a different
-- audience would weaken a constraint that is doing real work.
CREATE TABLE user_dashboard_layouts (
    layout_id   BIGSERIAL PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
    board       VARCHAR(40)  NOT NULL,
    -- JSON array of {id, x, y, w, h} placements, same shape the learner board stores.
    tile_order  TEXT         NOT NULL,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_dashboard_layout_user_board UNIQUE (user_id, board)
);

CREATE INDEX idx_user_dashboard_layouts_user ON user_dashboard_layouts (user_id);

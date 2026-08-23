import { base } from "./base"

/**
 * A dashboard arrangement for the signed-in user, per board.
 *
 * `[{ id, x, y, w, h }]` — where each tile sits and how many grid columns and
 * rows it takes. An empty list means "use the page defaults".
 *
 * The learner analytics board has its own learner-scoped pair in
 * studyDeskService; this one is keyed on the user, which is what lets the admin
 * and enterprise dashboards use it — neither audience has a learner profile.
 */
export function getBoardLayout(board) {
  return base(`dashboard-layout?board=${encodeURIComponent(board)}`)
}

export function saveBoardLayout(board, tiles) {
  return base(`dashboard-layout?board=${encodeURIComponent(board)}`, {
    method: "PUT",
    data: { tiles },
  })
}

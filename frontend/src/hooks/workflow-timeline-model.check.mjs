/**
 * Checks for the timeline reduction. Run with:
 *
 *   node src/hooks/workflow-timeline-model.check.mjs
 *
 * Plain node rather than a test framework: the repo has no frontend test
 * runner, and adding one for a single pure module would be a larger decision
 * than it deserves. The module is deliberately import-free so this works.
 */
import assert from "node:assert/strict"
import {
  applyEventToRun, buildTasks, findCurrentTask, mergeEvents, terminalStatus,
} from "./workflow-timeline-model.js"

let n = 0
const check = (name, fn) => { fn(); n++; console.log("  ok", name) }

const ev = (seq, event_type, extra = {}) => ({ seq, event_type, retry_count: 0, ...extra })

check("a start then a completion is one finished task", () => {
  const tasks = buildTasks([
    ev(1, "node.started", { stage: "lesson_content" }),
    ev(2, "node.completed", { stage: "lesson_content", task_status: "COMPLETED", duration_ms: 1200 }),
  ])
  assert.equal(tasks.length, 1)
  assert.equal(tasks[0].status, "COMPLETED")
  assert.equal(tasks[0].durationMs, 1200)
})

check("a regenerated stage records BOTH attempts, not one", () => {
  const tasks = buildTasks([
    ev(1, "node.started",   { stage: "lesson_content" }),
    ev(2, "node.completed", { stage: "lesson_content", task_status: "COMPLETED" }),
    ev(3, "node.started",   { stage: "lesson_content" }),
    ev(4, "node.completed", { stage: "lesson_content", task_status: "COMPLETED" }),
  ])
  assert.equal(tasks.length, 2, "second attempt overwrote the first")
})

check("a failed node is FAILED and carries its error", () => {
  const tasks = buildTasks([
    ev(1, "node.started",   { stage: "plan_curriculum" }),
    ev(2, "node.completed", { stage: "plan_curriculum", task_status: "FAILED", payload: { error: "rate limited" } }),
  ])
  assert.equal(tasks[0].status, "FAILED")
  assert.equal(tasks[0].error, "rate limited")
})

check("a completion with no start (post-reconnect) still appears", () => {
  const tasks = buildTasks([
    ev(7, "node.completed", { stage: "lesson_content", task_status: "COMPLETED", duration_ms: 900 }),
  ])
  assert.equal(tasks.length, 1, "work was dropped silently")
  assert.equal(tasks[0].status, "COMPLETED")
})

check("skip closes a review as SKIPPED, not FAILED", () => {
  const tasks = buildTasks([
    ev(1, "review.waiting",   { stage: "LESSON" }),
    ev(2, "review.submitted", { stage: "LESSON", payload: { action: "skip" } }),
  ])
  assert.equal(tasks[0].status, "SKIPPED")
})

check("reject closes a review the same way skip does", () => {
  const tasks = buildTasks([
    ev(1, "review.waiting",   { stage: "LESSON" }),
    ev(2, "review.submitted", { stage: "LESSON", payload: { action: "reject" } }),
  ])
  assert.equal(tasks[0].status, "SKIPPED")
})

check("approve closes a review as COMPLETED", () => {
  const tasks = buildTasks([
    ev(1, "review.waiting",   { stage: "MAJOR" }),
    ev(2, "review.submitted", { stage: "MAJOR", payload: { action: "approve" } }),
  ])
  assert.equal(tasks[0].status, "COMPLETED")
})

check("item numbers surface so the timeline can say '3 of 20'", () => {
  const tasks = buildTasks([
    ev(1, "node.started", { stage: "lesson_content", payload: { item_number: 3 } }),
  ])
  assert.equal(tasks[0].itemNumber, 3)
})

check("the current task is the newest one still open", () => {
  const tasks = buildTasks([
    ev(1, "node.started",   { stage: "a" }),
    ev(2, "node.completed", { stage: "a", task_status: "COMPLETED" }),
    ev(3, "node.started",   { stage: "b" }),
  ])
  assert.equal(findCurrentTask(tasks).stage, "b")
})

check("a finished run has no current task", () => {
  const tasks = buildTasks([
    ev(1, "node.started",   { stage: "a" }),
    ev(2, "node.completed", { stage: "a", task_status: "COMPLETED" }),
  ])
  assert.equal(findCurrentTask(tasks), null)
})

check("events without a stage are ignored, not rendered as blank rows", () => {
  assert.equal(buildTasks([ev(1, "workflow.started")]).length, 0)
})

check("merging is idempotent — a redelivered event does not duplicate", () => {
  const first = mergeEvents([], [ev(1, "node.started", { stage: "a" })])
  const again = mergeEvents(first, [ev(1, "node.started", { stage: "a" })])
  assert.equal(again.length, 1)
})

check("merge keeps events ordered by seq even when delivered out of order", () => {
  const merged = mergeEvents([], [ev(3, "x"), ev(1, "y"), ev(2, "z")])
  assert.deepEqual(merged.map((e) => e.seq), [1, 2, 3])
})

check("cancellation is a status, not a failure", () => {
  assert.equal(terminalStatus("workflow.cancelled", "RUNNING"), "CANCELLED")
  assert.equal(terminalStatus("workflow.failed", "RUNNING"), "FAILED")
  assert.equal(terminalStatus("workflow.completed", "RUNNING"), "COMPLETED")
})

check("review.waiting flips the run to WAITING_FOR_REVIEW live", () => {
  const run = applyEventToRun({ status: "RUNNING" }, ev(2, "review.waiting", { stage: "MAJOR" }))
  assert.equal(run.status, "WAITING_FOR_REVIEW")
  assert.equal(run.current_stage, "MAJOR")
})

check("a failure carries its message onto the run", () => {
  const run = applyEventToRun({ status: "RUNNING" }, ev(9, "workflow.failed", { payload: { error: "boom" } }))
  assert.equal(run.status, "FAILED")
  assert.equal(run.error_message, "boom")
})

console.log(`\n${n} checks passed`)

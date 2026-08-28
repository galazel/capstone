/**
 * Checks for the diagram tool palette. Run with:
 *
 *   node src/components/challenges/diagram-tool-presets.check.mjs
 *
 * Plain node rather than a test framework, matching
 * src/hooks/workflow-timeline-model.check.mjs: the repo has no frontend test
 * runner, and the module under test is deliberately import-free so this works.
 *
 * What matters here is that a question's type reaches the right palette. The
 * failure this guards against is silent: an unrecognised type falls back to
 * ERD, so a learner asked for a sequence diagram is handed entity shapes and
 * nothing anywhere reports a problem.
 */
import assert from "node:assert/strict"

import { getDiagramToolPreset } from "./diagram-tool-presets.js"

let n = 0
const check = (name, fn) => { fn(); n++; console.log("  ok", name) }

const libsOf = (type) => getDiagramToolPreset(type).libs

check("each of the seven generated types has its own palette", () => {
  assert.equal(libsOf("ERD"), "er")
  assert.equal(libsOf("UML_CLASS"), "uml")
  assert.equal(libsOf("UML_COMPONENT"), "uml")
  assert.equal(libsOf("SEQUENCE_DIAGRAM"), "uml")
  assert.equal(libsOf("USE_CASE"), "uml")
  assert.equal(libsOf("FLOWCHART"), "flowchart")
  assert.equal(libsOf("ACTIVITY_DIAGRAM"), "uml;flowchart")
})

check("no palette carries the general stencil set", () => {
  // The ask: only the tools for this diagram. "general" is every shape
  // draw.io ships, which is the opposite of that.
  for (const type of [
    "ERD", "UML_CLASS", "UML_COMPONENT", "SEQUENCE_DIAGRAM",
    "USE_CASE", "FLOWCHART", "ACTIVITY_DIAGRAM",
  ]) {
    assert.ok(
      !libsOf(type).split(";").includes("general"),
      `${type} still loads the general shape set`,
    )
  }
})

check("an ER question does not open with UML shapes, and vice versa", () => {
  assert.notEqual(libsOf("ERD"), libsOf("UML_CLASS"))
  assert.notEqual(libsOf("FLOWCHART"), libsOf("UML_CLASS"))
})

check("the spellings an older question may carry still resolve", () => {
  assert.equal(libsOf("UML_SEQUENCE"), libsOf("SEQUENCE_DIAGRAM"))
  assert.equal(libsOf("er diagram"), libsOf("ERD"))
  assert.equal(libsOf("Entity Relationship Diagram"), libsOf("ERD"))
  assert.equal(libsOf("class diagram"), libsOf("UML_CLASS"))
  assert.equal(libsOf("use case"), libsOf("USE_CASE"))
  assert.equal(libsOf("flow chart"), libsOf("FLOWCHART"))
})

check("retired types get their nearest palette, not the ERD fallback", () => {
  assert.equal(libsOf("DFD"), libsOf("FLOWCHART"))
  assert.equal(libsOf("NETWORK_DIAGRAM"), libsOf("UML_COMPONENT"))
})

check("an unknown type still yields a usable palette", () => {
  const preset = getDiagramToolPreset("SOMETHING_ELSE")
  assert.ok(preset.libs && preset.label)
})

check("a missing type does not throw", () => {
  assert.ok(getDiagramToolPreset(undefined).libs)
  assert.ok(getDiagramToolPreset(null).libs)
})

check("every label is human-readable", () => {
  assert.equal(getDiagramToolPreset("SEQUENCE_DIAGRAM").label, "Sequence Diagram")
  assert.equal(getDiagramToolPreset("ERD").label, "ER Diagram")
})

console.log(`\n${n} checks passed`)

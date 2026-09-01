import { buildTranscript, runProgress } from "./workflow-timeline-model.js"

/**
 * The document phase runs three graph nodes in a fixed order:
 *
 *   validate_documents -> capture_document_visuals -> ingest_documents
 *
 * Grouping merges only CONSECUTIVE tasks of the same family, so an unmapped
 * stage in the middle does not just get its own row -- it splits the phase
 * around itself. That produced two separate "Source documents" groups, one
 * holding the validate step and one holding the ingest step, which reads as
 * the documents having been read twice.
 */
function task(stage, seq, status = "COMPLETED") {
  return { stage, seq, status, itemNumber: null, durationMs: 1000 }
}

describe("document phase grouping", () => {
  it("keeps the whole document phase in one group", () => {
    const groups = buildTranscript([
      task("validate_documents", 1),
      task("capture_document_visuals", 2),
      task("ingest_documents", 3),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe("Source documents")
    expect(groups[0].steps.map((s) => s.stage)).toEqual([
      "validate_documents",
      "capture_document_visuals",
      "ingest_documents",
    ])
  })

  it("does not report the phase complete while a step is still running", () => {
    const groups = buildTranscript([
      task("validate_documents", 1),
      task("capture_document_visuals", 2),
      task("ingest_documents", 3, "RUNNING"),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].status).toBe("RUNNING")
  })

  it("still opens a new group when the family genuinely changes", () => {
    const groups = buildTranscript([
      task("validate_documents", 1),
      task("capture_document_visuals", 2),
      task("ingest_documents", 3),
      task("plan_curriculum", 4),
    ])

    expect(groups.map((g) => g.label)).toEqual(["Source documents", "Curriculum"])
  })
})

/**
 * Progress is a fraction of the run's *planned* steps, and the plan only exists
 * once the curriculum does. The two things worth pinning down are that the bar
 * stays honest before that point, and that redoing work at a review checkpoint
 * cannot push the fraction past what the run ever had to do.
 */
function planEvent(seq, plan) {
  return { seq, payload: { plan } }
}

const PLAN = { majors: 2, middles: 4, lessons: 10 }
// documents 3 + curriculum 1 + exams/bank 3, then 3/lesson, 2/middle, 2/major.
const PLAN_TOTAL = 7 + 3 * 10 + 2 * 4 + 2 * 2

describe("run progress", () => {
  it("has no percentage until the curriculum gives it a denominator", () => {
    const progress = runProgress(
      [task("validate_documents", 1), task("capture_document_visuals", 2)],
      [{ seq: 1, payload: {} }],
      "RUNNING",
    )

    expect(progress.percent).toBeNull()
    expect(progress.total).toBeNull()
  })

  it("counts finished steps against the plan the curriculum implies", () => {
    const progress = runProgress(
      [
        task("validate_documents", 1),
        task("capture_document_visuals", 2),
        task("ingest_documents", 3),
        task("plan_curriculum", 4),
      ],
      [planEvent(4, PLAN)],
      "RUNNING",
    )

    expect(progress.total).toBe(PLAN_TOTAL)
    expect(progress.done).toBe(4)
    expect(progress.percent).toBe(Math.round((4 / PLAN_TOTAL) * 100))
  })

  it("does not count a regenerated lesson twice", () => {
    const lesson = (seq, itemNumber) => [
      { ...task("lesson_content", seq), itemNumber },
      { ...task("lesson_quiz_generate", seq + 1), itemNumber },
      { ...task("lesson_validate", seq + 2), itemNumber },
    ]

    const once = runProgress(lesson(1, 1), [planEvent(1, PLAN)], "RUNNING")
    const twice = runProgress(
      [...lesson(1, 1), ...lesson(4, 1)],
      [planEvent(1, PLAN)],
      "RUNNING",
    )

    expect(once.done).toBe(3)
    expect(twice.done).toBe(3)
  })

  it("holds short of 100% while the run is still going, and reaches it when done", () => {
    // The smallest complete run: one lesson under one middle under one major,
    // plus the documents, the curriculum, and the two exams and the bank.
    const plan = { majors: 1, middles: 1, lessons: 1 }
    const every = [
      "validate_documents",
      "capture_document_visuals",
      "ingest_documents",
      "plan_curriculum",
      "lesson_content",
      "lesson_quiz_generate",
      "lesson_validate",
      "middle_generate",
      "middle_validate",
      "major_generate",
      "major_validate",
      "generate_mock_exam",
      "generate_diagnostic_exam",
      "generate_question_bank",
    ].map((stage, i) => ({ ...task(stage, i + 1), itemNumber: 1 }))

    const running = runProgress(every, [planEvent(1, plan)], "RUNNING")
    expect(running.done).toBe(running.total)
    expect(running.percent).toBe(99)

    expect(runProgress(every, [planEvent(1, plan)], "COMPLETED").percent).toBe(100)
  })
})

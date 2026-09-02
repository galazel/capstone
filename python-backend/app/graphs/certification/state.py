from typing import TypedDict, List, Dict, Optional, Annotated


def _keyed_merge(key_fields: tuple):
    """Builds a LangGraph reducer that upserts by a composite key instead of
    blindly concatenating. Send()-based fan-out nodes (lessons, major/middle/
    lesson quizzes) genuinely need an additive reducer to collect parallel
    branch outputs, but a plain `operator.add` also re-appends stale entries
    whenever a stage is regenerated (selective lesson retry, or a HITL
    "regenerate" decision re-running a fan-out) instead of replacing them."""

    def reducer(existing: List[Dict], new: List[Dict]) -> List[Dict]:
        merged = {tuple(item.get(f) for f in key_fields): item for item in (existing or [])}
        for item in new or []:
            merged[tuple(item.get(f) for f in key_fields)] = item
        return list(merged.values())

    return reducer


_merge_lessons = _keyed_merge(("name",))
_merge_major_quizzes = _keyed_merge(("majorCategory",))
_merge_middle_quizzes = _keyed_merge(("majorCategory", "middleCategory"))
_merge_lesson_quizzes = _keyed_merge(("lesson",))


class CertificationState(TypedDict, total=False):
    # Authoritative id of the Java-owned certification row. Used to scope this
    # run's FAISS index (see app/rag/store.namespace_for) so two certifications
    # can never share, or overwrite, one another's vectors.
    certification_id: int
    certification_name: str
    certification_description: str
    industry: str

    # The question formats the admin ticked on the create form, if they made a
    # choice: MCQ, SHORT_ANSWER, DESCRIPTIVE, CRITICAL_THINKING. Empty list
    # means "you decide", and the planner's research is used instead.
    #
    # Read through `researched_question_types`, which every generating stage
    # already calls -- so one answer at the start governs lesson quizzes, unit
    # exams, the diagnostic, the mock and the bank without each of them needing
    # to know where it came from.
    requested_question_types: List[str]

    # An outline of what the certification already holds, set only when this
    # run is adding to it. Empty string for an ordinary build.
    #
    # The planner is shown it and asked for only what the new documents add, so
    # the curriculum this run produces contains just the new nodes -- which is
    # what keeps every stage after it (lessons, quizzes, exams) from redoing
    # work that already exists.
    existing_curriculum: str

    # Preferred source: small `{s3_key, filename, content_type}` pointers.
    # LangGraph serializes the entire state into Postgres on every superstep,
    # so carrying raw file bytes here meant a 10 MB PDF was re-persisted on
    # each of ~20 checkpoints. Refs keep the bytes in S3.
    document_refs: List[Dict]

    # Fallback for the direct multipart upload route, where no S3 object
    # exists yet. Cleared by document_ingestion_node once the content has
    # been indexed, so the bytes survive ~2 checkpoints rather than all of
    # them.
    uploaded_files: List[Dict]

    # Screenshots of figures/diagrams/tables/charts captured out of the PDFs
    # in `document_refs`/`uploaded_files` -- {s3_key, source_file, page,
    # figure_index, bbox, width, height}, never raw image bytes (see
    # `app/rag/visuals.py`). Populated by `capture_document_visuals_node`
    # before ingestion clears `uploaded_files`.
    document_visuals: List[Dict]

    curriculum: Dict

    # Populated by Send() fan-out payloads when a branch is scoped to one
    # major/middle category or lesson. Declared explicitly so the graph
    # schema reflects every key nodes actually read.
    major: Dict
    middle: Dict
    lesson: Dict

    # Lessons authored ahead of the walk, keyed by their index in the
    # curriculum, waiting for the walk to reach them.
    #
    # The graph visits lessons one at a time -- gate, content, quiz, validate,
    # review, advance -- and that ordering is what the review loop and the
    # every-N checkpoint are built on. Authoring is the slow part and has no
    # ordering to it, so it runs ahead in batches and parks the results here;
    # the walk still arrives at each lesson in turn and finds it already
    # written. See `lesson_content_node`.
    #
    # Only ever populated on unattended runs: a supervised reviewer can edit or
    # regenerate a lesson, and content authored before they did so would be
    # stale in ways nothing here would notice.
    lesson_content_ahead: Dict

    # The quiz and the alignment audit for those same read-ahead lessons.
    #
    # Authoring a lesson is not the only AI call it costs: its quiz and its
    # audit are two more, and both were serial. Parallelising authoring alone
    # just moved the wait into them. All three run together in one task per
    # lesson -- the quiz and audit read the content the same task has just
    # written -- and each node collects its own part when the walk arrives.
    #
    # Separate keys rather than one bundle, so each node owns what it consumes
    # and no node depends on another having run first.
    lesson_quiz_ahead: Dict
    lesson_audit_ahead: Dict

    lessons: Annotated[List[Dict], _merge_lessons]
    major_quizzes: Annotated[List[Dict], _merge_major_quizzes]
    middle_quizzes: Annotated[List[Dict], _merge_middle_quizzes]
    lesson_quizzes: Annotated[List[Dict], _merge_lesson_quizzes]
    diagnostic_exam: Dict
    mock_exam: Dict
    # Single-node output (no Send() fan-out), so a plain field is correct:
    # regenerating replaces it wholesale instead of accumulating duplicates.
    question_bank: List[Dict]

    # --- per-item review loop (Phase 2b step 12) -------------------------
    # Position within each phase. The graph walks majors, then middles, then
    # lessons one at a time so an admin can approve item 1 and reject item 2 --
    # previously every item fanned out in parallel and a single review covered
    # all of them, making per-item judgement impossible.
    major_cursor: int
    middle_cursor: int
    lesson_cursor: int

    # "GUIDED" (pause at every review) or "AUTO" (generate straight through
    # without ever interrupting). Chosen when the run is started and settable
    # mid-run, so a reviewer who has seen enough can let the rest finish
    # unattended. See app/graphs/certification/review_mode.py.
    review_mode: str

    # Scopes ("MAJOR" | "MIDDLE" | "LESSON") the reviewer chose "Approve
    # Remaining" for. The review node checks this before interrupting, so the
    # rest of that phase drains without further pauses. Per-scope rather than
    # global: approving every remaining category shouldn't silently also
    # approve every lesson.
    auto_approve_scopes: List[str]

    # Items the reviewer rejected, kept so the run can report what was
    # dropped rather than silently omitting it.
    rejected_items: List[Dict]

    # LangGraph thread id, so nodes can write to the run registry. Set by
    # whoever starts the graph (consumer or HTTP route).
    thread_id: str

    # Lightweight references to artifact versions -- {key, revision, source,
    # instructions, event_seq}. The artifacts themselves live in
    # `workflow_events`: holding them here meant each regeneration added a
    # blob that was re-serialized into every later checkpoint.
    version_refs: List[Dict]

    # Scratch for the current review only, cleared when the cursor advances.
    review_instructions: Optional[str]
    review_edited_payload: Optional[Dict]
    # Revision number an "edit" payload was restored from, when the reviewer
    # rolled back rather than hand-editing. Distinguishes RESTORED from
    # MANUAL_EDIT in the version log.
    review_restored_from: Optional[int]

    audit_result: Optional[Dict]
    # Deterministic quality report shown alongside the artifact at review.
    validation_report: Optional[Dict]
    review_decision: Optional[str]

    # Namespace of the FAISS index this run ingested into. `extracted_text`
    # used to live here too, holding the entire concatenated document body --
    # it was written once and never read, while being re-serialized into every
    # Postgres checkpoint.
    vector_store_id: str

    status: str
    error_message: Optional[str]


def curriculum_totals(curriculum: Dict | None) -> Dict[str, int]:
    """How many majors, middle categories and lessons a curriculum implies.

    This is the denominator of a run's progress. The whole per-item walk is
    driven by these three lists (see `review_loop.LoopPhase.items_of`), so
    counting them counts the work the run has left -- and until the curriculum
    exists there is no honest denominator at all, which is why callers have to
    handle a plan of zero lessons rather than being given a guess.
    """
    majors = (curriculum or {}).get("majorCategories") or []
    middles = [
        middle for major in majors for middle in (major.get("middleCategories") or [])
    ]
    lessons = [lesson for middle in middles for lesson in (middle.get("lessons") or [])]
    return {"majors": len(majors), "middles": len(middles), "lessons": len(lessons)}

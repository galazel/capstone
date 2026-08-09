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

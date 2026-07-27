from typing import TypedDict, List, Dict, Optional, Annotated
from operator import add


class QuestionBankState(TypedDict, total=False):
    # LangGraph thread id, so nodes can write versions to the run registry.
    thread_id: str

    # --- Request / scope ---------------------------------------------------
    # Scopes retrieval to this certification's own FAISS index.
    certification_id: int
    certification_name: str
    scope_type: str  # "CERTIFICATION" | "MAJOR_CATEGORY" | "MIDDLE_CATEGORY" | "LESSON" | "ASSESSMENT"
    scope_label: str  # human-readable name of the target (lesson name, category name, etc.)
    # `{s3_key, filename, content_type}` pointers -- preferred, keeps bytes
    # out of every checkpoint. `uploaded_files` (inline bytes) remains for
    # the direct multipart upload route; resolve_scope_node clears it once
    # the reference context has been extracted.
    document_refs: List[Dict]
    uploaded_files: List[Dict]

    target_total: int
    batch_size: int
    type_distribution: Optional[Dict[str, int]]  # e.g. {"MCQ": 40, "PROGRAMMING": 10}, optional

    reference_context: str  # resolved once at the start: uploaded-file text and/or retrieved knowledge

    # --- Batch loop state ----------------------------------------------
    current_batch: List[Dict]
    generated_count: int

    # Deterministic quality report for the current batch, produced by
    # validate_batch_node and shown to the admin alongside the questions.
    validation_report: Optional[Dict]

    # Set by the reviewer's decision when resuming from await_batch_review;
    # cleared after being consumed by the router.
    review_action: Optional[str]  # "approve" | "edit" | "improve" | "regenerate" | "reject"
    review_instructions: Optional[str]  # free-form "Improve with AI" instructions
    review_edited_questions: Optional[List[Dict]]  # admin-edited questions for "edit"
    # Revision an "edit" payload was restored from, so the version log can
    # record RESTORED rather than MANUAL_EDIT.
    review_restored_from: Optional[int]

    # Approved questions across all batches, keyed by an editable id so a
    # later batch/version can still be told apart from an earlier one.
    approved_questions: Annotated[List[Dict], add]

    # Every version of every batch ever produced (AI-generated, AI-improved,
    # or manually edited) — the audit trail the admin compares and restores
    # from. These are lightweight refs only: the batches themselves live in
    # `workflow_events`, because carrying each full batch here meant LangGraph
    # re-serialized it into every later checkpoint.
    version_refs: Annotated[List[Dict], add]

    status: str
    error_message: Optional[str]

# Phase 2 — Python Backend & AI Pipeline Architectural Review

**Status: proposal only. No code has been changed.**
Everything below is grounded in the current `python-backend/` source, with file:line references. Runtime claims marked **(verified)** were proven by executing the code, not inferred.

---

## 0. Executive summary — three findings that outrank everything else

### 0.1 The RAG pipeline cannot run at all **(verified)**

`faiss` is not installed and is **not declared in `requirements.txt`**. Executing the real code path:

```
save_chunks([Document(...)])
→ ImportError: Could not import faiss python package.
```

`document_ingestion_node` (`app/graphs/certification/nodes.py:110`) calls `save_chunks` unconditionally and re-raises on failure (`:113-115`). It is the second node in the certification graph. **Every certification generation run currently dies before the curriculum is ever planned.** Any success you've seen came from a path that skips ingestion.

Compounding this: `langchain-community` (which provides the FAISS wrapper) is also undeclared — it resolves only transitively. Meanwhile `langchain-chroma` and `chromadb` *are* declared but are imported nowhere; the only surviving Chroma references are a stale log string (`nodes.py:107`) and a stale state literal `"vector_store_id": "chroma_db"` (`nodes.py:120`).

### 0.2 "Embeddings" are not semantic — the RAG is keyword-frequency matching

`app/services/ai/vector_db.py:14-36` defines `HashEmbeddings`: it tokenizes with `\w+`, SHA-256 hashes each token into one of 256 buckets, and accumulates raw counts.

This is a hashing bag-of-words vectorizer. It has **no semantic capability whatsoever** — "authentication" and "login" land in unrelated buckets and have cosine similarity ~0. At 256 dimensions with ~thousands of vocabulary tokens, hash collisions are severe. Retrieval quality is roughly "documents sharing literal tokens," strictly worse than SQL `LIKE`, because collisions add false positives.

Every downstream grounding claim in the system rests on this. Your brief names Hugging Face — that is the correct fix, and nothing in the codebase currently uses it.

### 0.3 The vector index is destroyed on every ingestion

```python
# vector_db.py:51-55
vector_store = FAISS.from_documents(chunks, get_embeddings())   # NEW index from ONLY these chunks
vector_store.save_local(PERSIST_DIRECTORY)                       # overwrites the single shared path
```

`PERSIST_DIRECTORY` is a hardcoded global `"./faiss_db"` (`:11`). `from_documents` builds a fresh index containing *only* the current run's chunks, then overwrites the shared directory. **Ingesting certification B silently erases certification A's vectors.** The `{"certification_name": ...}` metadata filter used at `nodes.py:222` and `question_bank/nodes.py:47` therefore filters over an index that only ever contains the most recent certification — it will return zero results for any earlier one, and the question-bank path swallows that failure silently (`question_bank/nodes.py:52-55`).

These three compound: a broken index, storing meaningless vectors, that also destroys itself. **The RAG layer needs replacement, not tuning.** This is the single highest-value item in Phase 2.

---

## 1. Current workflow analysis

### 1.1 Certification graph (`app/graphs/certification/workflow.py`)

Actual topology:

```
START → validate_documents → (stop | ingest_documents)
      → plan_curriculum → await_curriculum_review ─┬─ regenerate → plan_curriculum
                                                   └─ approve
      → major_quiz_dispatch_gate ══Send fan-out══> major_quiz_node (×N majors)
      → await_major_quiz_review (ONE review for ALL majors)
      → middle_quiz_dispatch_gate ══> middle_quiz_node (×N middles)
      → await_middle_quiz_review (ONE review for ALL middles)
      → lessons_dispatch_gate ══> lesson_creation_agent_node (×N lessons)
      → validate_lessons ─┬─ retry → lessons_dispatch_gate
                          └─ passed
      → lesson_quiz_dispatch_gate ══> lesson_quiz_node (×N lessons)
      → await_lesson_quiz_review (ONE review for ALL lesson quizzes)
      → generate_diagnostic_exam → await_diagnostic_exam_review
      → generate_mock_exam → await_mock_exam_review
      → generate_question_bank → await_question_bank_review → END
```

What genuinely works and should be preserved: HITL `interrupt()` at 8 checkpoints, `Send()`-based fan-out, keyed-merge reducers in `state.py:4-24` that correctly upsert-by-key instead of blindly appending on regeneration (a subtle bug most implementations get wrong), and selective lesson retry driven by `audit_result.failed_lessons` (`nodes.py:300-306`).

### 1.2 Gap analysis against your Phase 2 brief

| Brief requirement | Current state |
|---|---|
| Generate Major Category **content**, then its quiz | ❌ Only quizzes generated. Major/middle categories are never authored as content — they exist only as curriculum titles. |
| Per-category sequential loop (generate → quiz → validate → review → next) | ❌ All majors fan out in parallel, then **one** review covers all of them. Same for middles and lessons. An admin cannot approve category 1 and reject category 2. |
| AI validation before each review | ⚠️ Only lessons are validated (`validate_lessons_node`). Quizzes, exams, and the question bank get **zero** validation. Question-bank graph has **no validation node at all** (verified by grep). |
| Actions: Approve / Edit / Improve with AI / Regenerate / Reject | ❌ Certification graph supports only approve/regenerate (`route_after_review`, `nodes.py:271-272`). No edit, no improve-with-AI, no reject. ✅ Question-bank graph has all five. |
| Duplicate/hallucination/Bloom's/distractor-quality validation | ❌ Does not exist anywhere. |
| Bloom's level, objective mapping, estimated time, lesson/category refs on questions | ❌ `QuestionDraft` (`question_schema.py:14-36`) has none of these fields. |
| Version history, restore, compare | ⚠️ Question-bank only (`version_history` in state). Certification graph has none. |
| WebSocket / real-time dashboard | ❌ **Zero** websocket code in the entire codebase (verified by grep: 0 matches). |
| Resume paused runs from frontend | ⚠️ REST resume endpoints exist, but nothing lists *which* runs are paused — see §3.4. |

---

## 2. Architectural issues

### 2.1 Blocking / concurrency

- **18 of 18 graph nodes are sync `def`.** Only 6 `ainvoke` calls exist repo-wide vs 12 sync `.invoke(`. Every LLM call blocks a thread from AnyIO's default 40-thread pool. With `Send()` fan-out over, say, 60 lessons, you saturate the pool and starve unrelated HTTP requests on the same process.
- **`PostgresSaver` (sync) in an async app** (`helpers.py:29`). Every checkpoint write blocks the event loop's threadpool. `AsyncPostgresSaver` exists and is the correct choice.
- **Leaked context manager**: `_checkpointer_cm.__enter__()` is called and `__exit__` is *never* invoked (`helpers.py:29-31`). The connection is never returned or closed for the process lifetime.

### 2.2 Import-time side effects (this is why `uvicorn` failed earlier)

```python
certification_graph = build_certification_graph()   # workflow.py:203 — module scope
question_bank_graph = build_question_bank_graph()   # question_bank/workflow.py:60
```

`build_*` calls `get_checkpointer()`, which **opens a Postgres connection at import time**. Importing `app.main` therefore requires a live database. Additionally each agent module does `llm = get_llm("generation")` at module scope (`question_agent.py:7`, `lesson_agent.py:10`), constructing Groq clients on import.

Consequence: unit-testing any node requires a database and API keys. There are **zero tests for any graph, agent, or tool** — the 5 existing tests cover BKT math and health only. That is not a coincidence; the architecture makes graph tests impossible to write cheaply.

### 2.3 State bloat — the most expensive scaling problem

`CertificationState.uploaded_files: List[Dict]` carries **raw file bytes** (`state.py:33`, populated at `api/routes/certification.py:82`). `extracted_text: str` (`state.py:57`) holds the *entire* concatenated document text and is written at `nodes.py:119` — then never read again anywhere.

LangGraph serializes the **whole state into Postgres on every superstep**. With 8 HITL checkpoints plus per-node writes across a fan-out of dozens of lessons, a 10 MB PDF upload is persisted dozens of times. This is O(state_size × node_count) write amplification, and it is the thing most likely to fall over in production.

### 2.4 Coupling and separation of concerns

- `app/graphs/question_bank/nodes.py:9` imports `load_document` from `app.graphs.certification.nodes` — importing the question-bank graph transitively constructs **every certification agent and LLM client**, plus runs a `load_dotenv`.
- Document parsing (`load_document`, `split_documents`) lives inside a *graph node module* rather than an infrastructure/document service.
- Prompts are inlined as f-strings inside node functions (`nodes.py:192-201`, `328-348`, `444-453`) — orchestration and prompting are fused, so prompts can't be versioned, tested, or reused. Your brief explicitly asks for these to be separated.
- `_invoke_question_agent` is **duplicated verbatim** in `certification/nodes.py:438-459` and `question_bank/nodes.py:64-84`, as is `_retry_on_malformed_output` (`:39-44` / `:16-21`).

### 2.5 Retry strategy is aimed at the wrong failure

```python
retry_if_exception_type((KeyError, TypeError, ValueError))   # nodes.py:43
```

The dominant real-world failure with Groq is **HTTP 429 rate limiting**, then timeouts, then transient 5xx. None of those are `KeyError`/`TypeError`/`ValueError`, so none are retried. Meanwhile `wait_fixed(2)` has no jitter and no exponential backoff — under a 429 storm, parallel `Send()` branches retry in lockstep and re-trigger the same limit.

### 2.6 Chunking and retrieval quality

- `split_documents` (`nodes.py:56-67`) is fixed-width **character** slicing with no regard for sentence, paragraph, or section boundaries. `chunk_size=300` chars ≈ 75 tokens — far too small to carry a coherent concept, and it routinely cuts mid-word.
- Retrieval uses `k=5` (`nodes.py:222`). 5 × 300 chars ≈ **1,500 characters of context to author an entire certification curriculum.** This is the root cause of thin/hallucinated curricula, independent of the embedding problem.
- Metadata is minimal: `certification_name` + `source_file` (`nodes.py:94-97`). No page, section, heading, or chunk-ordinal, so no citation and no context-window expansion around a hit.

### 2.7 Observability

31 `print()` calls across the codebase, including inside nodes. `app/core/logging.py` exists and is configured in `main.py:17` but the graph layer ignores it entirely. In a background RabbitMQ consumer these prints go nowhere useful, carry no correlation id, and can't be filtered by level.

### 2.8 Two parallel async systems

Celery (`app/workers/`) handles BKT training; RabbitMQ consumers (`app/messaging/`) handle AI generation. Both are legitimate but there's no shared job/status model, so "what is running right now" has two different answers in two different places — which is exactly what the dashboard in your brief needs to unify.

---

## 3. Proposed architecture

### 3.1 Layering (Clean Architecture)

```
app/
├── api/                      HTTP + WS transport only. No business logic.
│   ├── routes/
│   └── ws/                   NEW: connection manager, event broadcast
├── orchestration/            NEW: LangGraph lives here (was graphs/)
│   ├── certification/        state.py · nodes/ · edges.py · graph.py
│   ├── question_bank/
│   └── shared/               review_actions.py, fanout.py, retry.py
├── domain/                   NEW: pure logic, zero I/O, trivially testable
│   ├── models/               Pydantic: Question, Lesson, Curriculum, Review
│   └── validation/           duplicate detection, Bloom's, distractor rules
├── ai/                       NEW: everything LLM-facing
│   ├── prompts/              versioned prompt templates (data, not code)
│   ├── agents/               thin factories, NOT module-level singletons
│   └── llm.py                provider abstraction + structured-output policy
├── rag/                      NEW: replaces services/ai/vector_db.py
│   ├── loaders.py · chunking.py · embeddings.py
│   ├── store.py              per-certification namespaced index
│   └── retriever.py          filter → rerank → assemble context
├── services/                 application services (BKT etc. — mostly fine today)
├── repositories/             persistence (already reasonable)
├── messaging/                RabbitMQ (already reasonable)
└── core/                     config, logging, DI container
```

Dependency rule: `api → orchestration → domain`, with `ai`/`rag`/`repositories` injected as interfaces. `domain/` imports nothing from the outer layers, which is what finally makes validation logic unit-testable without a database or an API key.

### 3.2 RAG redesign (highest priority)

| Concern | Now | Proposed |
|---|---|---|
| Embeddings | 256-dim SHA-256 token hashing | `sentence-transformers/all-MiniLM-L6-v2` via HuggingFace (384-dim, CPU-fine, no API cost). Interface-based so a hosted model can swap in. |
| Index | one global `./faiss_db`, overwritten per run | **One index per certification**, `faiss_db/cert_{id}/`. Eliminates the overwrite bug *and* the need for post-filtering. |
| Persistence | `from_documents` + overwrite | Load-existing → `add_documents` → save. Never destructive. |
| Chunking | 300-char fixed slices | `RecursiveCharacterTextSplitter`, ~1000 chars / 150 overlap, respecting `\n\n` → `\n` → sentence → word. |
| Metadata | name + filename | + page, section heading, chunk ordinal, doc id, ingested-at → enables citations and neighbour expansion. |
| Retrieval | `k=5`, no rerank | `k=20` → cross-encoder rerank → top 6-8 → assemble ≤ 8k tokens. |
| Grounding | none | Every generated artifact records `source_chunk_ids`; a validator flags claims with no supporting chunk. |

Declare explicitly: `faiss-cpu`, `langchain-community`, `sentence-transformers`. Drop the dead `langchain-chroma` / `chromadb`.

### 3.3 Certification workflow redesign

Restructure from "fan out everything, review once" to your specified **per-item sequential loop with a shared review sub-pattern**:

```
ingest → plan_curriculum → [REVIEW: curriculum]
  ↓
FOR EACH major (sequential, cursor in state):
    generate_major_content → generate_major_quiz → validate → [REVIEW: major]
  ↓
FOR EACH middle: generate → quiz → validate → [REVIEW: middle]
  ↓
FOR EACH lesson: generate → quiz → validate → [REVIEW: lesson]
  ↓
diagnostic → validate → [REVIEW] → mock → validate → [REVIEW]
  ↓
question_bank (batched) → validate → [REVIEW] → publish_gate → END
```

`[REVIEW: x]` is one reusable sub-pattern, not eight copies:

```
interrupt({stage, artifact, validation_report, version_history})
  ├ approve    → advance cursor
  ├ edit       → replace artifact with admin payload, snapshot version, advance
  ├ improve    → store NL instructions in state, regenerate THIS item only, re-review
  ├ regenerate → regenerate THIS item, no guidance, re-review
  └ reject     → mark rejected, hold at this checkpoint
```

Parallelism is preserved *within* an item (e.g. a lesson's sections), while review granularity becomes per-item as the brief requires. Where independent items must still run concurrently, keep `Send()` but gate the review behind a per-item cursor rather than collapsing to one approval.

### 3.4 The missing piece: a run registry

Today a HITL pause leaves `generation_requests.status = PROCESSING` forever and **nothing can enumerate paused runs** — the frontend cannot discover that a review is waiting. This is the gap that blocks the entire dashboard in your brief.

Proposal — a `workflow_runs` + `workflow_events` pair owned by Python:

```
workflow_runs:   run_id, thread_id, kind, certification_id, current_stage,
                 status, progress_pct, started_at, updated_at, triggered_by_user_id
workflow_events: event_id, run_id, seq, type, stage, payload, created_at
```

`workflow_events` doubles as the WebSocket replay log, so a reconnecting client catches up from `last_seq` instead of losing history — this is what makes the live dashboard reliable rather than best-effort.

### 3.5 State slimming

Move file bytes **out** of graph state. `uploaded_files` becomes `document_refs: list[DocumentRef]` (`{s3_key, filename, content_type}`) — nodes fetch bytes on demand via the existing `app/storage/s3_client.py`. Delete `extracted_text` from state (write-only today). Large artifacts move to `workflow_artifacts` rows, with state holding ids.

Expected effect: checkpoint rows drop from megabytes to kilobytes, which is what makes 8+ HITL checkpoints per run affordable.

### 3.6 Retry / resilience

```python
retry(
  retry=retry_if_exception_type((RateLimitError, APITimeoutError, APIConnectionError,
                                 StructuredOutputError)),
  wait=wait_exponential_jitter(initial=2, max=60),
  stop=stop_after_attempt(5),
  reraise=True,
)
```

Plus: a shared token-bucket limiter across concurrent `Send()` branches (Groq limits are per-account, not per-branch), and `retry_count` persisted per node into `workflow_events` so the dashboard can surface it.

### 3.7 Question model expansion

`QuestionDraft` gains: `bloom_level`, `learning_objective_id`, `lesson_ref`, `category_ref`, `estimated_seconds`, `source_chunk_ids`, plus per-type `@model_validator` enforcement (MCQ ⇒ exactly 4 choices and a valid `correct_choice_index`; PROGRAMMING ⇒ ≥1 test case; etc.). Today those rules live **only** in the system prompt (`question_agent.py:22-33`) — i.e. they are requests, not constraints.

### 3.8 WebSocket layer

`/ws/workflows/{run_id}` with `?last_seq=` replay. Events: `workflow.started`, `node.started`, `node.completed`, `validation.completed`, `review.waiting`, `review.submitted`, `workflow.resumed`, `workflow.completed`, `workflow.failed`. Broadcast is a thin projection of `workflow_events` inserts, so REST and WS can never disagree — and REST polling remains a working fallback.

---

## 4. Migration strategy — split into 2a and 2b

**Decision (approved):** Phase 2 is split. **2a makes the existing pipeline actually work**; **2b restructures it** to the HITL architecture in the brief.

The dividing line: 2a changes *no workflow shape*. The graph topology, node set, and review points stay exactly as they are today — they just stop being broken. 2b is where behaviour changes. That keeps the risky redesign sitting on a foundation that is already verified working, instead of debugging both at once.

### Phase 2a — Make it work correctly

| # | Step | Risk | Fixes |
|---|---|---|---|
| 1 | Declare `faiss-cpu`, `langchain-community`, `sentence-transformers`; drop dead `langchain-chroma`/`chromadb` | Low | §0.1 — pipeline can't run at all |
| 2 | Rebuild `rag/`: HF embeddings, per-certification index, non-destructive persistence, recursive chunking, richer metadata, `k=20` → rerank | Med | §0.2, §0.3, §2.6 |
| 3 | Lazy graph/agent construction + DI; first real graph/node tests | Low | §2.2 — currently untestable |
| 4 | Async nodes + `AsyncPostgresSaver`; fix the leaked context manager | Med | §2.1 |
| 5 | Slim state: S3 refs instead of file bytes, drop write-only `extracted_text` | Med | §2.3 — checkpoint write amplification |
| 6 | Extract prompts to `ai/prompts/`; dedupe the duplicated invoke + retry helpers | Low | §2.4 |
| 7 | Retry policy: rate-limit/timeout aware, exponential + jitter, shared token bucket | Low | §2.5 |
| 8 | Replace 31 `print()` with structured logging + correlation ids | Low | §2.7 |

**Exit criteria for 2a:** a certification generation run completes end-to-end against real documents; retrieval returns semantically relevant chunks; ingesting a second certification leaves the first one's index intact; checkpoint rows are KB not MB; graph nodes have tests that run without a live database.

### Phase 2b — Restructure to the specified HITL architecture

| # | Step | Risk |
|---|---|---|
| 9 | `domain/validation/` + validation nodes on every artifact (duplicates, Bloom's, distractors, hallucination, objective alignment) | Med |
| 10 | Question model expansion: `bloom_level`, objective mapping, lesson/category refs, estimated time, `source_chunk_ids`, per-type validators | Low |
| 11 | `workflow_runs` / `workflow_events` run registry (§3.4) | Med |
| 12 | Certification graph → per-item sequential generate→quiz→validate→review loop | **High** |
| 13 | 5-action review sub-pattern + version history for certification (parity with question-bank) | Med |
| 14 | WebSocket layer + event projection | Med |
| 15 | Frontend AI Generation Dashboard | Med |

---

## 5. Open questions

**Q1 — Sequencing.** ✅ **Answered: split into 2a / 2b.** Reflected above.

**Q6 — NEW, raised by the Phase 3 brief (§6): node granularity.** The
requested workspace lists *Loading Documents, Extracting Content, Cleaning
and Normalizing Text, Detecting Headings, Detecting Tables, Detecting Code
Blocks, Detecting Figures, Semantic Chunking, Generating Embeddings, Storing
Vector Embeddings, Retrieving Context* as **eleven separate observable
tasks**. Today all eleven are a single `document_ingestion_node`. This is a
2b-blocking decision — see §6.2.

**Q3 — Embedding model.** Blocks 2a step 2. Proceeding with `sentence-transformers/all-MiniLM-L6-v2` (384-dim, CPU-only, no API cost) unless redirected. Behind an interface, so swapping to `bge-base-en-v1.5` later is a one-line change.

The remaining questions are **2b-scoped and can be deferred** until 2a lands:

- **Q2 — Major/middle category *content*.** Categories are currently only titles. Should they get authored prose, or is "title + quiz" sufficient?
- **Q4 — Reviewer concurrency.** 40-80 review checkpoints per certification is a lot of clicks. Want a "bulk approve remaining" escape hatch?
- **Q5 — Where approved artifacts land.** Only the curriculum is written back to Java today; quizzes, exams, and the bank are generated then discarded. Should they persist into Java's `exams`/`questions` tables?

---

## 6. Phase 3 (queued) — AI Generation Workspace & Frontend Experience

Requested mid-Phase-2a. Recorded here so the 2b design accounts for it
rather than being reworked afterward. **Not started.**

### 6.1 Requirement summary

A Claude-Code / Cursor-Agent-style workspace replacing the loading spinner.
Every LangGraph node surfaces as a live task with status, elapsed time,
retry count, and execution detail, streamed over WebSocket with no polling
or refresh. Task statuses: `Pending`, `Running`, `Completed`,
`Waiting for Review`, `Retrying`, `Failed`, `Skipped`, `Cancelled`.

### 6.2 The consequence for Phase 2b — node granularity must increase

This is the important part, and it changes 2b's design.

The requested task list treats document processing as **eleven** observable
steps (Loading → Extracting → Cleaning → Detecting Headings → Detecting
Tables → Detecting Code Blocks → Detecting Figures → Semantic Chunking →
Generating Embeddings → Storing Vectors → Retrieving Context). After 2a,
that entire span is **one** node, `document_ingestion_node`, internally
calling `load_uploads` → `chunk_documents` → `add_documents`.

Two ways to reconcile, and they are genuinely different architectures:

| Option | How | Trade-off |
|---|---|---|
| **A. Split into real graph nodes** | Each step becomes its own LangGraph node with its own state transition | Truthful — the UI reflects actual execution. But a checkpoint write per step, and heading/table/code/figure detection do not exist yet and must be built |
| **B. Sub-step events inside coarse nodes** | Nodes stay as-is; each emits `workflow_events` rows as it progresses internally | Much cheaper, no checkpoint explosion, UI looks identical. But a sub-step isn't independently resumable — a failure at "Detecting Tables" replays the whole ingestion node |

**Recommendation: B for document processing, A for generation stages.**
Ingestion sub-steps are fast, deterministic, and cheap to redo, so
independent resumability buys little and costs a checkpoint per step.
Generation stages (curriculum, per-category, per-lesson, exams) are slow and
expensive, so those genuinely need to be real nodes with real checkpoints —
which 2b step 12 already does.

Either way, the `workflow_events` table from §3.4 is the substrate: it is
what the timeline renders from and what a reconnecting client replays.

### 6.3 Also net-new work

- **Heading / table / code-block / figure detection does not exist.** 2a
  chunks on text separators only. These are new document-analysis
  capabilities (pdfplumber or similar for tables/figures), not refactors.
- **`Cancelled` status implies workflow cancellation**, which has no
  mechanism today — needs a cooperative cancel flag checked between nodes.
- **`Retrying` needs per-node retry state surfaced.** 2a made retries
  rate-limit-aware; 2b step 11 must persist attempt counts to
  `workflow_events` for the UI to show them.

### 6.4 Open question

The brief's task list ends mid-item ("Generating Lesson / Generating
Lesson") and does not cover the diagnostic exam, mock exam, question bank,
final review, or publish stages — though §3.3's earlier stage list does.
Assuming the intended list continues through those; worth confirming when
Phase 3 starts.

---

## 7. Answered design questions (Q2, Q4, Q6)

**Q2 — Category content. ANSWERED: organizational only.**
Major and Middle categories carry a title and an associated assessment, and
**no AI-generated instructional content**. All instructional material lives in
lessons. Each lesson must contain: title, introduction, learning objectives,
estimated study time, main instructional content, examples and explanations,
figures/diagrams where appropriate, summary, key terms, and a lesson quiz.
Model: Cisco Networking Academy -- categories organize, lessons teach.

*Consequence for step 12:* the per-item loop for major/middle categories is
**generate quiz → validate → review**, with no content-generation node. Only
the lesson loop generates content. This makes step 12 smaller than planned.
`GeneratedLessonSections` must also be checked against the required lesson
anatomy above.

**Q4 — Reviewer concurrency. ANSWERED: add "Approve Remaining".**
Human review stays mandatory, but after inspecting enough items a reviewer can
approve the rest in bulk. Every item keeps individual Approve / Reject /
Regenerate. So the certification review action set is:
`Approve`, `Reject`, `Regenerate`, `Approve Remaining`.

*Consequence for step 13:* "Approve Remaining" is a new state flag
(e.g. `auto_approve_remaining`) that the review node checks before
interrupting, letting the loop drain without further pauses.

**Q6 — Node granularity. ANSWERED: agreed — hybrid.**
Ingestion stays **one LangGraph node** emitting fine-grained progress events;
generation stages become **separate nodes**.

Ingestion events to emit: reading document, detecting document type,
extracting text, detecting headings, detecting tables, detecting code blocks,
detecting figures/diagrams, extracting figure captions, OCR when necessary,
cleaning/normalizing, chunking, creating embeddings, indexing.

Generation nodes: curriculum planning, major category generation, middle
category generation, lesson generation, lesson assessment generation, category
assessment generation, mock exam generation, certification assembly, human
review checkpoints, publishing.

Confirmed as **net-new capability**, not refactoring: heading detection, table
extraction, code-block detection, figure detection, caption extraction, and
OCR do not exist today (step 2 chunks on text separators only). OCR in
particular adds a dependency (e.g. Tesseract) and meaningful runtime cost.

from langchain_core.messages import AIMessage, HumanMessage

from app.graphs.tutor.workflow import get_tutor_graph

#: The graph node an appended turn is attributed to. `aupdate_state` refuses
#: to guess ("Ambiguous update, specify as_node") and requires a node that
#: actually writes the channel being updated -- `respond_question` is the one
#: that returns `{"messages": [...]}`.
_APPEND_AS_NODE = "respond_question"


async def get_conversation(session_id: str):
    """The learner/AI turns saved for this thread, oldest first.

    Keyed by the same `session_id` the `/tutor/chat` route uses as its
    checkpointer thread_id -- not rebuilt from learner/lesson ids here, so a
    caller can't drift from whatever scheme the chat route actually threads
    on (see `lesson-ai-tutor.jsx`'s `${learnerId}-${lessonId}` convention).

    Filters out system messages (lesson content, conversation summaries):
    those are context fed to the model, not turns the learner had.
    """
    config = {"configurable": {"thread_id": session_id}}
    # Cached: previously this rebuilt and recompiled the entire graph on
    # every call just to read one checkpoint.
    graph = await get_tutor_graph()
    snapshot = await graph.aget_state(config)

    messages = snapshot.values.get("messages", []) if snapshot else []

    conversation = []
    for message in messages:
        if message.type not in ("human", "ai"):
            continue
        entry = {
            "role": "user" if message.type == "human" else "assistant",
            "content": message.content,
        }
        # Set by `append_messages` for a generated quiz/flashcard turn, so the
        # tutor can re-render its "Take the quiz" card after a refresh rather
        # than degrading to a sentence about something the learner can no
        # longer open from here.
        action = (message.additional_kwargs or {}).get("action")
        if action:
            entry["action"] = action
        conversation.append(entry)
    return conversation


async def append_messages(session_id: str, messages: list[dict]):
    """Writes turns into the thread WITHOUT invoking the model.

    The AI tutor's "generate a quiz/flashcards" action is a real exchange the
    learner had -- they asked, the tutor answered -- but it never runs through
    the graph, so nothing recorded it and it vanished on refresh while typed
    questions survived. This appends it to the same checkpointed thread the
    chat turns live in, so the whole conversation reloads as one history.
    """
    if not messages:
        return

    graph = await get_tutor_graph()
    config = {"configurable": {"thread_id": session_id}}

    to_append = []
    for message in messages:
        content = message.get("content") or ""
        if message.get("role") == "user":
            to_append.append(HumanMessage(content=content))
        else:
            extra = {"action": message["action"]} if message.get("action") else {}
            to_append.append(AIMessage(content=content, additional_kwargs=extra))

    await graph.aupdate_state(
        config, {"messages": to_append}, as_node=_APPEND_AS_NODE
    )

from app.utils.helpers import get_config
from app.graphs.tutor.workflow import get_tutor_graph


async def get_conversation(learner_id: int, lesson_id: int):

    config = get_config(learner_id, lesson_id)
    # Cached: previously this rebuilt and recompiled the entire graph on
    # every call just to read one checkpoint.
    graph = await get_tutor_graph()
    snapshot = await graph.aget_state(config)

    messages = snapshot.values.get("messages", [])

    return [
        {
            "type": message.type,
            "content": message.content,
        }
        for message in messages
    ]
from app.utils.helpers import get_config
from app.graphs.tutor.workflow import build_graph


def get_conversation(learner_id: int, lesson_id: int):

    config = get_config(learner_id, lesson_id)
    snapshot = build_graph().get_state(config)

    messages = snapshot.values.get("messages", [])

    return [
        {
            "type": message.type,
            "content": message.content,
        }
        for message in messages
    ]
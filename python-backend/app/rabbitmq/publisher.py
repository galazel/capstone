import json
import pika


def publish_curriculum_generated(channel, certification_id):

    event = {
        "certificationId": certification_id,
        "status": "COMPLETED",
        "message": "Curriculum generated successfully."
    }

    channel.basic_publish(
        exchange="assessment.exchange",
        routing_key="curriculum.generated",
        body=json.dumps(event),
        properties=pika.BasicProperties(
            content_type="application/json",
            delivery_mode=2
        )
    )

    print("Published curriculum.generated event")
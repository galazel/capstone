import json

from rabbitmq.connection import get_channel
from rabbitmq.publisher import publish_curriculum_generated


connection, channel = get_channel()


channel.queue_declare(
    queue="curriculum.queue",
    durable=True
)

channel.queue_bind(
    exchange="certification.exchange",
    queue="curriculum.queue",
    routing_key="certification.created"
)

channel.basic_qos(prefetch_count=1)

def callback(ch, method, properties, body):

    try:

        certification_request = json.loads(body)

        print("Received:")
        print(certification_request)

        curriculum = generate_curriculum(
            certification_request
        )

        # TODO:
        # Save curriculum to database

        publish_curriculum_generated(
            ch,
            certification_request["id"]
        )

        ch.basic_ack(
            delivery_tag=method.delivery_tag
        )

    except Exception as e:

        print(e)

        ch.basic_nack(
            delivery_tag=method.delivery_tag,
            requeue=False
        )

channel.basic_consume(
    queue="curriculum.queue",
    on_message_callback=callback,
    auto_ack=False
)


def start_consumer():
    print("Waiting for curriculum requests...")
    channel.start_consuming()
import pika


def get_connection():
    return pika.BlockingConnection(
        pika.ConnectionParameters(
            host="localhost",
            port=5672,
            credentials=pika.PlainCredentials(
                "guest",
                "guest"
            )
        )
    )


def get_channel():
    connection = get_connection()
    channel = connection.channel()

    # Exchanges
    channel.exchange_declare(
        exchange="certification.exchange",
        exchange_type="topic",
        durable=True
    )

    channel.exchange_declare(
        exchange="assessment.exchange",
        exchange_type="topic",
        durable=True
    )

    return connection, channel
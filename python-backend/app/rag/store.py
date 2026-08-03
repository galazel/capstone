"""Per-certification vector storage, backed by Qdrant.

Each certification gets its own Qdrant *collection*, which is what makes
cross-certification bleed structurally impossible: a retrieval is scoped by
the collection it queries, so no metadata filter can be forgotten. That
property is inherited from the FAISS implementation this replaced, and the
reason it existed there is worth keeping in view -- the original code rebuilt
one global index on every ingestion, so ingesting certification B erased
certification A.

Why Qdrant over the previous local FAISS files:

* FAISS indexes lived on the API process's own disk, so they could not be
  shared between processes and vanished with the container. Qdrant is a
  service, so ingestion and retrieval can run anywhere.
* `FAISS.load_local` required `allow_dangerous_deserialization=True` -- it
  unpickles. That was tolerable only because this service was the sole
  writer.
* Appending meant load-whole-index, mutate, rewrite-whole-index. Qdrant
  upserts.

The public surface is deliberately unchanged (`namespace_for`,
`index_exists`, `add_documents`, `delete_index`, `load_index`) so callers --
the certification graph, the question-bank graph, and run recovery -- did not
have to change.
"""

from __future__ import annotations

import logging
import re
import uuid
from functools import lru_cache

from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from qdrant_client import QdrantClient
from qdrant_client.http import models as qdrant_models

from app.core.config import get_settings
from app.rag.embeddings import resolve_embeddings

logger = logging.getLogger(__name__)

#: Payload keys. Kept explicit because they are a storage format: renaming one
#: silently orphans every point already written under the old name.
CONTENT_KEY = "page_content"
METADATA_KEY = "metadata"


class QdrantIndex:
    """The handle `load_index` returns: a collection plus the embedding model
    needed to query it.

    Written by hand rather than taken from `langchain-qdrant`, which still
    pins `langchain-core<1` and downgrading core breaks langgraph. The only
    method callers use is `similarity_search`, so the wrapper is small enough
    that the dependency was not worth the conflict.
    """

    __slots__ = ("_client", "_collection", "_embeddings")

    def __init__(self, client: QdrantClient, collection: str, embeddings: Embeddings) -> None:
        self._client = client
        self._collection = collection
        self._embeddings = embeddings

    def similarity_search(self, query: str, k: int = 4) -> list[Document]:
        hits = self._client.query_points(
            collection_name=self._collection,
            query=self._embeddings.embed_query(query),
            limit=k,
            with_payload=True,
        ).points

        return [
            Document(
                page_content=(hit.payload or {}).get(CONTENT_KEY, ""),
                metadata=(hit.payload or {}).get(METADATA_KEY) or {},
            )
            for hit in hits
        ]


class VectorStoreUnavailable(RuntimeError):
    """Qdrant could not be reached.

    Deliberately distinct from "this certification has nothing indexed yet":
    that is a normal state answered with an empty result, whereas this means
    the knowledge base is unreadable and a generation grounded on it would
    quietly invent its content instead of using the source documents.
    """


def namespace_for(certification_id: int | None = None, certification_name: str = "") -> str:
    """Stable collection name.

    Prefers the numeric id (authoritative, immutable). Falls back to a slug
    of the name for callers that only have a title -- renaming a
    certification then orphans its collection, which is why id is preferred.
    """
    if certification_id is not None:
        return f"cert_{certification_id}"
    slug = re.sub(r"[^a-z0-9]+", "-", (certification_name or "").lower()).strip("-")
    return f"cert-name-{slug}" if slug else "cert-unknown"


@lru_cache(maxsize=1)
def get_client() -> QdrantClient:
    """The shared Qdrant connection.

    Cached because `QdrantClient` holds a connection pool; building one per
    call would open a socket per chunk during ingestion.
    """
    settings = get_settings()
    return QdrantClient(
        url=settings.qdrant_url,
        api_key=settings.qdrant_api_key or None,
        timeout=settings.qdrant_timeout_seconds,
    )


def reset_client() -> None:
    """Drops the cached connection. For tests, and after a config change."""
    get_client.cache_clear()


def _collection_exists(namespace: str) -> bool:
    try:
        return get_client().collection_exists(namespace)
    except Exception as error:
        raise VectorStoreUnavailable(
            f"Qdrant at {get_settings().qdrant_url} is unreachable: {error}"
        ) from error


def count(namespace: str) -> int:
    """Chunks currently indexed for a certification.

    Exposed because callers (and tests) legitimately need to know how much
    source material a run has, and the alternative was reaching into the
    backend's internals -- the FAISS version was asserted with
    `index.index.ntotal`, which tied tests to the storage engine.
    """
    if not _collection_exists(namespace):
        return 0
    return get_client().count(namespace, exact=True).count


def index_exists(namespace: str) -> bool:
    """Whether this certification has anything indexed.

    A collection that exists but is empty counts as *not* indexed: it would
    retrieve nothing, and callers use this to decide whether a run has usable
    source material at all.
    """
    if not _collection_exists(namespace):
        return False
    return get_client().count(namespace, exact=False).count > 0


def _vector_size(embeddings: Embeddings) -> int:
    """Probed rather than configured, so a collection is always created with
    the dimension the *current* embedding model emits. Hard-coding 384 would
    break the day the model changed, surfacing as a Qdrant dimension error
    partway through an ingestion rather than at startup."""
    return len(embeddings.embed_query("dimension probe"))


def _ensure_collection(namespace: str, embeddings: Embeddings) -> None:
    if _collection_exists(namespace):
        return
    get_client().create_collection(
        collection_name=namespace,
        vectors_config=qdrant_models.VectorParams(
            size=_vector_size(embeddings),
            distance=qdrant_models.Distance.COSINE,
        ),
    )
    logger.info("Created Qdrant collection '%s'", namespace)


def load_index(namespace: str, embeddings: Embeddings | None = None) -> QdrantIndex | None:
    """A handle to an existing collection, or None when this certification has
    never been ingested. Returning None (rather than raising) lets callers
    treat "no knowledge base yet" as a normal, non-fatal state."""
    if not index_exists(namespace):
        return None
    return QdrantIndex(get_client(), namespace, resolve_embeddings(embeddings))


def add_documents(
    namespace: str,
    documents: list[Document],
    embeddings: Embeddings | None = None,
) -> int:
    """Upserts chunks into a certification's collection, creating it on first
    use. Non-destructive: existing points are never removed, so re-ingesting a
    second document set for the same certification is additive.
    """
    if not documents:
        return 0

    resolved = resolve_embeddings(embeddings)
    _ensure_collection(namespace, resolved)

    vectors = resolved.embed_documents([doc.page_content for doc in documents])
    points = [
        qdrant_models.PointStruct(
            # Random ids rather than content hashes: re-ingesting the same
            # document is meant to be additive, and hashing would make it a
            # silent no-op.
            id=str(uuid.uuid4()),
            vector=vector,
            payload={CONTENT_KEY: doc.page_content, METADATA_KEY: doc.metadata or {}},
        )
        for doc, vector in zip(documents, vectors)
    ]

    get_client().upsert(collection_name=namespace, points=points, wait=True)
    logger.info("Indexed %d chunks into Qdrant collection '%s'", len(documents), namespace)
    return len(documents)


def delete_index(namespace: str) -> bool:
    """Removes a certification's collection. Used when regenerating from
    scratch, so stale chunks cannot leak into the new run."""
    if not _collection_exists(namespace):
        return False
    get_client().delete_collection(namespace)
    logger.info("Deleted Qdrant collection '%s'", namespace)
    return True

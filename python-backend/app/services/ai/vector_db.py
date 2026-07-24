import hashlib
import re
import collections
import os
from functools import lru_cache
from typing import Iterable, List

from langchain_community.vectorstores import FAISS
from langchain_core.embeddings import Embeddings

PERSIST_DIRECTORY = "./faiss_db"


class HashEmbeddings(Embeddings):
    """Optimized local embedding implementation using token frequency counting."""
    dimension = 256

    def _embed(self, text: str) -> List[float]:
        vector = [0.0] * self.dimension
        tokens = re.findall(r"\w+", text.lower())
        token_counts = collections.Counter(tokens)

        for token, count in token_counts.items():
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            index = int.from_bytes(digest[:4], "little") % self.dimension
            vector[index] += float(count)

        norm = sum(value * value for value in vector) ** 0.5
        return [value / norm for value in vector] if norm else vector

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [self._embed(text) for text in texts]

    def embed_query(self, text: str) -> List[float]:
        return self._embed(text)


@lru_cache(maxsize=1)
def get_embeddings() -> HashEmbeddings:
    return HashEmbeddings()


def save_chunks(all_chunks: Iterable) -> None:
    chunks = list(all_chunks)
    if not chunks:
        return

    print(f"Building FAISS index for {len(chunks)} chunks... (This will be instant)")

    # FAISS ingests everything safely in memory, no SQLite deadlocks.
    vector_store = FAISS.from_documents(chunks, get_embeddings())

    # Save the index to disk
    os.makedirs(PERSIST_DIRECTORY, exist_ok=True)
    vector_store.save_local(PERSIST_DIRECTORY)

    print("FAISS index saved successfully.")


def get_vector_store() -> FAISS:
    return FAISS.load_local(
        PERSIST_DIRECTORY,
        get_embeddings(),
        allow_dangerous_deserialization=True  # Required for loading local FAISS files
    )
"""Checkpointer lifecycle tests (Phase 2a step 4).

The previous implementation called `cm.__enter__()` and never `__exit__()`,
so the Postgres connection was held for the process lifetime, and it had no
guard against two concurrent first-callers each opening their own connection.
Both are what these tests pin down.
"""

from __future__ import annotations

import asyncio

import pytest

from app.utils import helpers


class _FakeSaver:
    def __init__(self, owner):
        self._owner = owner

    async def setup(self):
        self._owner.setup_calls += 1


class _FakeCM:
    """Mimics AsyncPostgresSaver.from_conn_string()'s async context manager."""

    def __init__(self, owner):
        self._owner = owner

    async def __aenter__(self):
        self._owner.enters += 1
        return _FakeSaver(self._owner)

    async def __aexit__(self, *exc):
        self._owner.exits += 1
        return False


class _FakeFactory:
    def __init__(self):
        self.enters = 0
        self.exits = 0
        self.setup_calls = 0

    def from_conn_string(self, _conn):
        return _FakeCM(self)


@pytest.fixture()
def fake_saver(monkeypatch):
    factory = _FakeFactory()
    monkeypatch.setattr(helpers, "AsyncPostgresSaver", factory)
    # Reset module singletons so each test starts cold.
    monkeypatch.setattr(helpers, "_checkpointer", None, raising=False)
    monkeypatch.setattr(helpers, "_checkpointer_cm", None, raising=False)
    monkeypatch.setattr(helpers, "_checkpointer_lock", asyncio.Lock(), raising=False)
    yield factory


async def test_checkpointer_is_created_once_and_setup_once(fake_saver):
    first = await helpers.get_checkpointer()
    second = await helpers.get_checkpointer()

    assert first is second
    assert fake_saver.enters == 1
    assert fake_saver.setup_calls == 1


async def test_concurrent_first_calls_do_not_open_two_connections(fake_saver):
    """Without the lock, both coroutines see `None` and each opens a
    connection -- one of which is then leaked with no reference to close it."""
    results = await asyncio.gather(*(helpers.get_checkpointer() for _ in range(8)))

    assert fake_saver.enters == 1, "opened more than one connection"
    assert len({id(r) for r in results}) == 1, "callers got different checkpointers"


async def test_close_releases_the_connection(fake_saver):
    await helpers.get_checkpointer()
    await helpers.close_checkpointer()

    assert fake_saver.exits == 1, "connection was never released (the original leak)"


async def test_close_is_idempotent(fake_saver):
    await helpers.get_checkpointer()
    await helpers.close_checkpointer()
    await helpers.close_checkpointer()

    assert fake_saver.exits == 1


async def test_close_without_open_is_a_noop(fake_saver):
    await helpers.close_checkpointer()
    assert fake_saver.exits == 0


async def test_reopen_after_close_creates_a_fresh_connection(fake_saver):
    await helpers.get_checkpointer()
    await helpers.close_checkpointer()
    await helpers.get_checkpointer()

    assert fake_saver.enters == 2
    assert fake_saver.exits == 1

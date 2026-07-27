"""Pure domain logic: no I/O, no framework, no provider SDK.

Everything here is a deterministic function over plain data, which is what
makes it cheap to test exhaustively. Contrast with `app/graphs/` (orchestration)
and `app/ai/` (model interaction).
"""

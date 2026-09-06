"""Short-lived ingestion snapshots; avoid upstream HTTP calls on every API read."""
import asyncio
import copy
import functools
import time
from backend.config import demo_enabled

_cache = {}
_pending = {}


def cached_snapshot(name, ttl=900):
    def decorate(fn):
        @functools.wraps(fn)
        async def wrapped(*args, force_refresh=False, **kwargs):
            if args or kwargs.get("client") is not None:
                return await fn(*args, **kwargs)
            key = (name, demo_enabled(), repr(sorted(kwargs.items())))
            cached = _cache.get(key)
            if not force_refresh and cached and time.monotonic() - cached[0] < ttl:
                return copy.deepcopy(cached[1])
            pending_key = (asyncio.get_running_loop(), key)
            task = _pending.get(pending_key)
            if task is None:
                task = asyncio.create_task(fn(**kwargs))
                _pending[pending_key] = task
            try:
                result = await task
                _cache[key] = (time.monotonic(), result)
                return copy.deepcopy(result)
            finally:
                _pending.pop(pending_key, None)
        return wrapped
    return decorate

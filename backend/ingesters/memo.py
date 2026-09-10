"""Short-lived ingestion snapshots; avoid upstream HTTP calls on every API read."""
import asyncio
import copy
import functools
import time
from backend.config import demo_enabled

_cache = {}
_pending = {}
_MAX_CACHE_ENTRIES = 128
_MAX_PENDING_TASKS = 32


def cached_snapshot(name, ttl=900):
    def decorate(fn):
        @functools.wraps(fn)
        async def wrapped(*args, force_refresh=False, **kwargs):
            if args or kwargs.get("client") is not None:
                return await fn(*args, **kwargs)
            key = (name, demo_enabled(), repr(sorted(kwargs.items())))
            now = time.monotonic()
            for stale_key, (created_at, _) in list(_cache.items()):
                if now - created_at >= ttl:
                    _cache.pop(stale_key, None)
            cached = _cache.get(key)
            if not force_refresh and cached:
                return copy.deepcopy(cached[1])
            pending_key = (asyncio.get_running_loop(), key)
            task = _pending.get(pending_key)
            if task is None:
                if len(_pending) >= _MAX_PENDING_TASKS:
                    raise RuntimeError("Too many distinct snapshot computations are already running")
                task = asyncio.create_task(fn(**kwargs))
                _pending[pending_key] = task
            try:
                result = await task
                _cache[key] = (time.monotonic(), result)
                if len(_cache) > _MAX_CACHE_ENTRIES:
                    oldest_key = min(_cache, key=lambda item: _cache[item][0])
                    _cache.pop(oldest_key, None)
                return copy.deepcopy(result)
            finally:
                _pending.pop(pending_key, None)
        return wrapped
    return decorate

import asyncio
import logging

logger = logging.getLogger(__name__)

_BACKGROUND_TASKS: set[asyncio.Task] = set()
_semaphore: asyncio.Semaphore | None = None
MAX_BACKGROUND_TASKS = 50


def _get_semaphore() -> asyncio.Semaphore:
    global _semaphore
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(MAX_BACKGROUND_TASKS)
    return _semaphore


def run_in_background(coro) -> asyncio.Task:
    async def _guard():
        async with _get_semaphore():
            try:
                await coro
            except Exception:
                logger.warning("Background task failed", exc_info=True)

    task = asyncio.create_task(_guard())
    _BACKGROUND_TASKS.add(task)
    task.add_done_callback(_BACKGROUND_TASKS.discard)
    return task
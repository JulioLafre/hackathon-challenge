from collections import defaultdict, deque
from math import ceil
from threading import Lock
from time import monotonic


class LoginRateLimiter:
    def __init__(self, max_attempts: int = 5, window_seconds: int = 900) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._failures: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def retry_after(self, key: str) -> int | None:
        now = monotonic()
        with self._lock:
            failures = self._failures[key]
            self._discard_expired(failures, now)
            if len(failures) < self.max_attempts:
                return None
            return max(1, ceil(self.window_seconds - (now - failures[0])))

    def record_failure(self, key: str) -> None:
        now = monotonic()
        with self._lock:
            failures = self._failures[key]
            self._discard_expired(failures, now)
            failures.append(now)

    def reset(self, key: str) -> None:
        with self._lock:
            self._failures.pop(key, None)

    def _discard_expired(self, failures: deque[float], now: float) -> None:
        cutoff = now - self.window_seconds
        while failures and failures[0] <= cutoff:
            failures.popleft()

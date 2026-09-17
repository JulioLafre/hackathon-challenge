from collections import defaultdict, deque
from math import ceil
from threading import Lock
from time import monotonic


class PublicRateLimiter:
    def __init__(self, max_requests: int, window_seconds: int) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def consume(self, key: str) -> int | None:
        now = monotonic()
        with self._lock:
            requests = self._requests[key]
            cutoff = now - self.window_seconds
            while requests and requests[0] <= cutoff:
                requests.popleft()
            if len(requests) >= self.max_requests:
                return max(1, ceil(self.window_seconds - (now - requests[0])))
            requests.append(now)
        return None

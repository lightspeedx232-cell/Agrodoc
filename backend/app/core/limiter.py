"""Application-wide rate limiter (slowapi).

Guards auth and image-analysis endpoints against brute-force / abuse.
Disabled automatically in tests when ``RATE_LIMIT_ENABLED=false``.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from ..config import settings

limiter = Limiter(
    key_func=get_remote_address,
    enabled=settings.RATE_LIMIT_ENABLED,
    default_limits=["1000 per hour"],
)

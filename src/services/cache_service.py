"""
Redis/Valkey caching service for MEXC Sniper Bot
Provides async caching with graceful degradation when Redis is unavailable
"""

import json
import logging
from datetime import timedelta
from typing import Any, Optional, Union

import redis.asyncio as redis
from redis.exceptions import ConnectionError as RedisConnectionError, RedisError

from src.config import settings

logger = logging.getLogger(__name__)


class CacheService:
    """
    Async Redis/Valkey cache service with graceful degradation

    Features:
    - JSON serialization/deserialization
    - TTL-based expiration
    - Graceful degradation when Redis unavailable
    - Namespace isolation with key prefixes
    - Non-blocking operations with silent failures
    """

    def __init__(self, redis_url: Optional[str] = None, key_prefix: str = "mexc"):
        self.redis_url = redis_url or settings.REDIS_URL
        self.key_prefix = key_prefix
        self.redis_client: Optional[redis.Redis] = None
        self.is_available = False
        self.connection_attempts = 0
        self.max_connection_attempts = 3

        # Default TTL values (in seconds)
        self.default_ttl = 5
        self.ttl_config = {
            "symbols": 5,  # Symbol data changes frequently
            "calendar": 30,  # Calendar data is more stable
            "account": 60,  # Account info rarely changes
            "server_time": 10,  # Server time for sync
        }

    async def start(self) -> bool:
        """
        Initialize Redis connection
        Returns True if connection successful, False otherwise
        """
        if not self.redis_url:
            logger.info("Redis URL not configured, cache service will operate in no-op mode")
            return False

        try:
            # Parse Redis URL and create client with optimized connection pooling
            self.redis_client = redis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=3,  # Faster connection timeout for trading
                socket_timeout=3,  # Faster socket timeout
                retry_on_timeout=True,
                retry_on_error=[RedisConnectionError],
                health_check_interval=15,  # More frequent health checks
                max_connections=settings.CONNECTION_POOL_SIZE,
                connection_pool_kwargs={
                    "retry_on_timeout": True,
                    "socket_keepalive": True,
                    "socket_keepalive_options": {},
                },
            )

            # Test connection
            await self.redis_client.ping()
            self.is_available = True
            self.connection_attempts = 0

            logger.info(f"Cache service connected to Redis at {self._mask_url(self.redis_url)}")
            return True

        except (RedisConnectionError, RedisError, Exception) as e:
            self.connection_attempts += 1
            logger.warning(f"Failed to connect to Redis (attempt {self.connection_attempts}): {e}")

            if self.connection_attempts >= self.max_connection_attempts:
                logger.warning("Max Redis connection attempts reached, operating in no-op mode")

            self.is_available = False
            self.redis_client = None
            return False

    async def close(self):
        """Close Redis connection"""
        if self.redis_client:
            try:
                await self.redis_client.close()
                logger.info("Cache service connection closed")
            except Exception as e:
                logger.warning(f"Error closing Redis connection: {e}")
            finally:
                self.redis_client = None
                self.is_available = False

    def _make_key(self, key: str) -> str:
        """Create namespaced cache key"""
        return f"{self.key_prefix}:{key}"

    def _mask_url(self, url: str) -> str:
        """Mask sensitive parts of Redis URL for logging"""
        if not url:
            return "None"

        try:
            # Simple masking - replace password if present
            if "@" in url and ":" in url:
                parts = url.split("@")
                if len(parts) == 2:
                    auth_part = parts[0]
                    if ":" in auth_part:
                        protocol_user = auth_part.rsplit(":", 1)[0]
                        return f"{protocol_user}:***@{parts[1]}"
            return url
        except Exception:
            return "***"

    def _serialize_value(self, value: Any) -> str:
        """Serialize value to JSON string"""
        try:
            return json.dumps(value, default=str, ensure_ascii=False)
        except (TypeError, ValueError) as e:
            logger.warning(f"Failed to serialize cache value: {e}")
            raise

    def _deserialize_value(self, value: str) -> Any:
        """Deserialize JSON string to value"""
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError) as e:
            logger.warning(f"Failed to deserialize cache value: {e}")
            return None

    def _get_ttl(self, cache_type: str) -> int:
        """Get TTL for cache type"""
        return self.ttl_config.get(cache_type, self.default_ttl)

    async def _ensure_connection(self) -> bool:
        """Ensure Redis connection is available"""
        if not self.is_available and self.connection_attempts < self.max_connection_attempts:
            return await self.start()
        return self.is_available

    async def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache
        Returns None if key not found or cache unavailable
        """
        if not await self._ensure_connection() or not self.redis_client:
            return None

        try:
            cache_key = self._make_key(key)
            value = await self.redis_client.get(cache_key)

            if value is None:
                logger.debug(f"Cache miss for key: {key}")
                return None

            logger.debug(f"Cache hit for key: {key}")
            return self._deserialize_value(value)

        except (RedisError, json.JSONDecodeError, Exception) as e:
            logger.warning(f"Cache get error for key {key}: {e}")
            return None

    async def set(
        self, key: str, value: Any, ttl: Optional[Union[int, timedelta]] = None, cache_type: str = "default"
    ) -> bool:
        """
        Set value in cache with TTL
        Returns True if successful, False otherwise
        """
        if not await self._ensure_connection() or not self.redis_client:
            return False

        try:
            cache_key = self._make_key(key)
            serialized_value = self._serialize_value(value)

            # Determine TTL
            if ttl is None:
                ttl = self._get_ttl(cache_type)
            elif isinstance(ttl, timedelta):
                ttl = int(ttl.total_seconds())

            # Set with expiration
            await self.redis_client.setex(cache_key, ttl, serialized_value)

            logger.debug(f"Cache set for key: {key}, TTL: {ttl}s")
            return True

        except (RedisError, TypeError, ValueError, Exception) as e:
            logger.warning(f"Cache set error for key {key}: {e}")
            return False

    async def delete(self, key: str) -> bool:
        """
        Delete key from cache
        Returns True if successful, False otherwise
        """
        if not await self._ensure_connection() or not self.redis_client:
            return False

        try:
            cache_key = self._make_key(key)
            result = await self.redis_client.delete(cache_key)

            logger.debug(f"Cache delete for key: {key}, existed: {bool(result)}")
            return bool(result)

        except (RedisError, Exception) as e:
            logger.warning(f"Cache delete error for key {key}: {e}")
            return False

    async def exists(self, key: str) -> bool:
        """
        Check if key exists in cache
        Returns False if cache unavailable
        """
        if not await self._ensure_connection() or not self.redis_client:
            return False

        try:
            cache_key = self._make_key(key)
            result = await self.redis_client.exists(cache_key)
            return bool(result)

        except (RedisError, Exception) as e:
            logger.warning(f"Cache exists error for key {key}: {e}")
            return False

    async def clear_pattern(self, pattern: str) -> int:
        """
        Clear all keys matching pattern
        Returns number of keys deleted, 0 if cache unavailable
        """
        if not await self._ensure_connection() or not self.redis_client:
            return 0

        try:
            cache_pattern = self._make_key(pattern)
            keys = await self.redis_client.keys(cache_pattern)

            if keys:
                deleted = await self.redis_client.delete(*keys)
                logger.info(f"Cache cleared {deleted} keys matching pattern: {pattern}")
                return deleted

            return 0

        except (RedisError, Exception) as e:
            logger.warning(f"Cache clear pattern error for {pattern}: {e}")
            return 0

    async def get_stats(self) -> dict[str, Any]:
        """
        Get cache statistics
        Returns empty dict if cache unavailable
        """
        if not await self._ensure_connection() or not self.redis_client:
            return {
                "available": False,
                "connection_attempts": self.connection_attempts,
                "redis_url_configured": bool(self.redis_url),
            }

        try:
            info = await self.redis_client.info()

            return {
                "available": True,
                "connected_clients": info.get("connected_clients", 0),
                "used_memory": info.get("used_memory_human", "0B"),
                "total_commands_processed": info.get("total_commands_processed", 0),
                "keyspace_hits": info.get("keyspace_hits", 0),
                "keyspace_misses": info.get("keyspace_misses", 0),
                "redis_version": info.get("redis_version", "unknown"),
                "uptime_in_seconds": info.get("uptime_in_seconds", 0),
            }

        except (RedisError, Exception) as e:
            logger.warning(f"Cache stats error: {e}")
            return {"available": False, "error": str(e)}


# Global cache service instance
_cache_service: Optional[CacheService] = None


async def get_cache_service() -> CacheService:
    """Get global cache service instance"""
    global _cache_service

    if _cache_service is None:
        _cache_service = CacheService()
        await _cache_service.start()

    # Type narrowing: after the if block, _cache_service is guaranteed to be CacheService
    from typing import cast
    return cast(CacheService, _cache_service)


async def close_cache_service():
    """Close global cache service"""
    global _cache_service
    from typing import cast

    if _cache_service is not None:
        await cast(CacheService, _cache_service).close()
        _cache_service = None

"""
Configuration management for MEXC Sniper Bot Pattern Discovery System
"""
from typing import Optional, Tuple

from pydantic_settings import BaseSettings, SettingsConfigDict


class AppConfig(BaseSettings):
    """Application configuration using Pydantic settings"""

    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        extra='ignore',
        case_sensitive=False
    )

    # API Settings
    OPENAI_API_KEY: str
    MEXC_API_KEY: Optional[str] = None
    MEXC_SECRET_KEY: Optional[str] = None

    # Database Settings
    DATABASE_URL: Optional[str] = None
    USE_TURSO_DB: bool = False
    TURSO_DATABASE_URL: Optional[str] = None
    TURSO_AUTH_TOKEN: Optional[str] = None

    # Cache Settings (Redis/Valkey)
    REDIS_URL: Optional[str] = None
    VALKEY_URL: Optional[str] = None  # Alternative to REDIS_URL
    CACHE_TTL_SYMBOLS: int = 5        # TTL for symbols data (seconds)
    CACHE_TTL_CALENDAR: int = 30      # TTL for calendar data (seconds)
    CACHE_TTL_ACCOUNT: int = 60       # TTL for account data (seconds)

    # Inngest Settings
    INNGEST_EVENT_KEY: Optional[str] = None
    INNGEST_SIGNING_KEY: Optional[str] = None
    INNGEST_BASE_URL: Optional[str] = None
    INNGEST_API_BASE_URL: Optional[str] = None

    # MEXC API Endpoints
    MEXC_BASE_URL: str = "https://api.mexc.com"
    MEXC_CALENDAR_ENDPOINT: str = "/api/operation/new_coin_calendar"
    MEXC_SYMBOLS_V2_ENDPOINT: str = "/api/platform/spot/market-v2/web/symbolsV2"
    MEXC_ORDER_ENDPOINT: str = "/api/v3/order"

    # Pattern Discovery Settings
    READY_STATE_PATTERN: Tuple[int, int, int] = (2, 2, 4)  # sts:2, st:2, tt:4
    TARGET_ADVANCE_HOURS: float = 3.5  # Target advance notice in hours

    # Monitoring Intervals
    CALENDAR_POLL_INTERVAL_SECONDS: int = 300  # 5 minutes
    CALENDAR_POLL_CRON: str = "*/5 * * * *"   # Inngest cron: every 5 minutes
    SYMBOLS_POLL_INTERVAL_SECONDS_DEFAULT: int = 30
    SYMBOLS_POLL_INTERVAL_SECONDS_NEAR_LAUNCH: int = 5
    SYMBOLS_POLL_NEAR_LAUNCH_THRESHOLD_MINUTES: int = 60

    # Trading Settings
    DEFAULT_BUY_AMOUNT_USDT: float = 100.0
    MAX_CONCURRENT_SNIPES: int = 3

    # Application Settings
    LOG_LEVEL: str = "INFO"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    @property
    def is_production(self) -> bool:
        """Check if running in production environment"""
        return self.ENVIRONMENT.lower() == "production"

    @property
    def mexc_api_configured(self) -> bool:
        """Check if MEXC API credentials are configured"""
        return bool(self.MEXC_API_KEY and self.MEXC_SECRET_KEY)

    @property
    def database_configured(self) -> bool:
        """Check if database is configured"""
        return bool(self.DATABASE_URL)

    @property
    def redis_configured(self) -> bool:
        """Check if Redis/Valkey is configured"""
        return bool(self.REDIS_URL or self.VALKEY_URL)

    @property
    def cache_url(self) -> Optional[str]:
        """Get the cache URL (Redis or Valkey)"""
        return self.REDIS_URL or self.VALKEY_URL

    @property
    def inngest_configured(self) -> bool:
        """Check if Inngest is configured"""
        return bool(self.INNGEST_SIGNING_KEY)


# Global settings instance
settings = AppConfig()


def get_settings() -> AppConfig:
    """Get application settings instance"""
    return settings

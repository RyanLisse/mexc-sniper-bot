"""
Database models for MEXC Sniper Bot Pattern Discovery System
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from pydantic import BaseModel
from sqlmodel import Field as SQLField, SQLModel

# --- Pydantic Models for API Validation & Business Logic ---


class BaseApiModel(BaseModel):
    """Base model for API responses"""

    class Config:
        from_attributes = True


class CalendarEntryApi(BaseApiModel):
    """Calendar entry from MEXC API"""

    vcoinId: str
    symbol: str
    projectName: str
    firstOpenTime: int  # Unix timestamp in milliseconds

    @property
    def launch_datetime(self) -> datetime:
        """Convert timestamp to datetime"""
        return datetime.fromtimestamp(self.firstOpenTime / 1000, tz=timezone.utc)


class SymbolV2EntryApi(BaseApiModel):
    """Symbol entry from MEXC symbolsV2 API"""

    cd: str  # vcoinId
    ca: str | None = None  # Contract address (symbol like "BTCUSDT")
    ps: int | None = None  # Price scale
    qs: int | None = None  # Quantity scale
    sts: int  # Status 1
    st: int  # Status 2
    tt: int  # Status 3
    ot: int | None = None  # Open time (ms)

    def matches_ready_pattern(self, pattern: tuple) -> bool:
        """Check if symbol matches the ready state pattern"""
        return (self.sts, self.st, self.tt) == pattern

    @property
    def has_complete_data(self) -> bool:
        """Check if symbol has all required trading data"""
        return all([self.ca, self.ps is not None, self.qs is not None, self.ot is not None])

    @property
    def launch_datetime_from_ot(self) -> datetime | None:
        """Get launch datetime from ot field"""
        if self.ot:
            return datetime.fromtimestamp(self.ot / 1000, tz=timezone.utc)
        return None


class SnipeTargetApi(BaseApiModel):
    """Snipe target for API responses"""

    vcoin_id: str
    symbol_contract: str
    project_name: str
    price_precision: int
    quantity_precision: int
    launch_time: datetime
    discovered_at: datetime
    hours_advance_notice: float
    order_params: dict[str, Any]

    @property
    def time_until_launch(self) -> timedelta:
        """Calculate time until launch"""
        return self.launch_time - datetime.now(timezone.utc)


# --- SQLModel Table Models for Database Persistence ---


class MonitoredListing(SQLModel, table=True):
    """Table for tracking monitored token listings from calendar"""

    __tablename__: str = "monitored_listings"

    vcoin_id: str = SQLField(primary_key=True, index=True)
    symbol_name: str
    project_name: str
    announced_launch_time_ms: int
    announced_launch_datetime_utc: datetime

    # Status tracking
    status: str = SQLField(default="monitoring", index=True)
    # Possible statuses: monitoring, ready, scheduled, executed_success, executed_failed, error, missed

    # Timestamps
    created_at: datetime = SQLField(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = SQLField(default_factory=lambda: datetime.now(timezone.utc))

    # Relationship (disabled for now due to SQLModel issues)
    # snipe_target: "SnipeTarget" = Relationship(back_populates="listing")


class SnipeTarget(SQLModel, table=True):
    """Table for storing ready tokens with execution parameters"""

    __tablename__: str = "snipe_targets"

    id: int | None = SQLField(default=None, primary_key=True, index=True)
    vcoin_id: str = SQLField(foreign_key="monitored_listings.vcoin_id", unique=True)

    # Token details
    mexc_symbol_contract: str  # This is 'ca' from symbolsV2
    price_precision: int
    quantity_precision: int
    actual_launch_time_ms: int  # This is 'ot' from symbolsV2
    actual_launch_datetime_utc: datetime

    # Discovery details
    discovered_at_utc: datetime
    hours_advance_notice: float

    # Trading configuration
    intended_buy_amount_usdt: float
    execution_order_params_json: str = SQLField(default="{}")  # JSON string

    # Execution tracking
    execution_status: str = SQLField(default="pending", index=True)
    # Possible statuses: pending, scheduled, executing, success, failed, cancelled
    execution_response_json: str | None = SQLField(default=None)  # JSON string
    executed_at_utc: datetime | None = SQLField(default=None)

    # Timestamps
    created_at: datetime = SQLField(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = SQLField(default_factory=lambda: datetime.now(timezone.utc))

    # Relationship (disabled for now due to SQLModel issues)
    # listing: MonitoredListing = Relationship(back_populates="snipe_target")

    @property
    def execution_order_params(self) -> dict[str, Any]:
        """Get execution order parameters as dict"""
        try:
            return json.loads(self.execution_order_params_json)
        except (json.JSONDecodeError, TypeError):
            return {}

    @execution_order_params.setter
    def execution_order_params(self, value: dict[str, Any]):
        """Set execution order parameters from dict"""
        self.execution_order_params_json = json.dumps(value)

    @property
    def execution_response(self) -> dict[str, Any] | None:
        """Get execution response as dict"""
        if not self.execution_response_json:
            return None
        try:
            return json.loads(self.execution_response_json)
        except (json.JSONDecodeError, TypeError):
            return None

    @execution_response.setter
    def execution_response(self, value: dict[str, Any] | None):
        """Set execution response from dict"""
        if value is None:
            self.execution_response_json = None
        else:
            self.execution_response_json = json.dumps(value)

    def __getattribute__(self, name):
        """Ensure executed_at_utc always returns timezone-aware datetime"""
        value = super().__getattribute__(name)
        if name == "executed_at_utc" and value is not None and value.tzinfo is None:
            # Add UTC timezone to timezone-naive datetime
            return value.replace(tzinfo=timezone.utc)
        return value


class ExecutionHistory(SQLModel, table=True):
    """Table for tracking execution history and performance"""

    __tablename__: str = "execution_history"

    id: int | None = SQLField(default=None, primary_key=True, index=True)
    vcoin_id: str = SQLField(index=True)
    symbol_contract: str

    # Execution details
    execution_timestamp: datetime
    execution_type: str  # "snipe", "manual", "test"
    buy_amount_usdt: float
    execution_duration_ms: float | None = None

    # Results
    success: bool
    order_id: str | None = None
    filled_quantity: float | None = None
    average_price: float | None = None
    total_cost_usdt: float | None = None

    # Performance metrics
    advance_notice_hours: float | None = None
    price_impact_percent: float | None = None

    # Error details
    error_message: str | None = None
    error_code: str | None = None

    # Timestamps
    created_at: datetime = SQLField(default_factory=lambda: datetime.now(timezone.utc))


class UserPreferences(SQLModel, table=True):
    """Table for storing user preferences and trading configuration"""

    __tablename__: str = "user_preferences"

    id: int | None = SQLField(default=None, primary_key=True, index=True)
    user_id: str = SQLField(unique=True, index=True)  # User identifier (could be session ID or user ID)

    # Risk Management
    stop_loss_enabled: bool = SQLField(default=True)
    stop_loss_type: str = SQLField(default="percentage")  # "percentage" or "amount"
    stop_loss_percentage: float = SQLField(default=10.0)
    stop_loss_amount: float = SQLField(default=0.0)

    take_profit_enabled: bool = SQLField(default=True)
    take_profit_type: str = SQLField(default="percentage")  # "percentage" or "amount"
    take_profit_percentage: float = SQLField(default=50.0)
    take_profit_amount: float = SQLField(default=0.0)

    # Position Sizing
    default_buy_amount: float = SQLField(default=100.0)  # USDT
    max_positions_per_token: int = SQLField(default=1)
    risk_per_trade: float = SQLField(default=2.0)  # Percentage of portfolio

    # Pattern Detection
    pattern_monitoring_enabled: bool = SQLField(default=True)
    target_pattern_sts: int = SQLField(default=2)
    target_pattern_st: int = SQLField(default=2)
    target_pattern_tt: int = SQLField(default=4)

    # Auto-trading
    auto_trading_enabled: bool = SQLField(default=False)
    max_daily_trades: int = SQLField(default=10)
    min_market_cap: float = SQLField(default=0.0)  # Minimum market cap filter

    # Notifications
    telegram_notifications: bool = SQLField(default=False)
    email_notifications: bool = SQLField(default=False)
    discord_notifications: bool = SQLField(default=False)

    # Timestamps
    created_at: datetime = SQLField(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = SQLField(default_factory=lambda: datetime.now(timezone.utc))


class ApiCredentials(SQLModel, table=True):
    """Table for storing encrypted API credentials"""

    __tablename__: str = "api_credentials"

    id: int | None = SQLField(default=None, primary_key=True, index=True)
    user_id: str = SQLField(index=True)  # User identifier
    provider: str = SQLField(index=True)  # "mexc", "binance", etc.

    # Encrypted credentials (base64 encoded)
    api_key_encrypted: str | None = None
    secret_key_encrypted: str | None = None
    passphrase_encrypted: str | None = None  # For some exchanges

    # Metadata
    is_active: bool = SQLField(default=True)
    is_testnet: bool = SQLField(default=False)
    nickname: str | None = None  # User-friendly name for the credentials

    # Permissions (JSON string)
    permissions_json: str = SQLField(default='["spot_trading"]')  # JSON array of permissions

    # Timestamps
    created_at: datetime = SQLField(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = SQLField(default_factory=lambda: datetime.now(timezone.utc))
    last_used_at: datetime | None = None

    @property
    def permissions(self) -> list[str]:
        """Get permissions as list"""
        try:
            return json.loads(self.permissions_json)
        except (json.JSONDecodeError, TypeError):
            return ["spot_trading"]

    @permissions.setter
    def permissions(self, value: list[str]):
        """Set permissions from list"""
        self.permissions_json = json.dumps(value)


# --- API Response Models ---


class MonitoredListingResponse(BaseApiModel):
    """Response model for monitored listings"""

    vcoin_id: str
    symbol_name: str
    project_name: str
    announced_launch_datetime_utc: datetime
    status: str
    created_at: datetime
    updated_at: datetime


class SnipeTargetResponse(BaseApiModel):
    """Response model for snipe targets"""

    id: int
    vcoin_id: str
    mexc_symbol_contract: str
    price_precision: int
    quantity_precision: int
    actual_launch_datetime_utc: datetime
    discovered_at_utc: datetime
    hours_advance_notice: float
    intended_buy_amount_usdt: float
    execution_status: str
    executed_at_utc: datetime | None
    listing: MonitoredListingResponse | None = None


class PatternDiscoveryStats(BaseApiModel):
    """Statistics for pattern discovery system"""

    total_monitored_listings: int
    total_ready_targets: int
    total_executed: int
    success_rate: float
    average_advance_notice_hours: float
    total_profit_usdt: float


class UserPreferencesResponse(BaseApiModel):
    """Response model for user preferences"""

    id: int
    user_id: str

    # Risk Management
    stop_loss_enabled: bool
    stop_loss_type: str
    stop_loss_percentage: float
    stop_loss_amount: float

    take_profit_enabled: bool
    take_profit_type: str
    take_profit_percentage: float
    take_profit_amount: float

    # Position Sizing
    default_buy_amount: float
    max_positions_per_token: int
    risk_per_trade: float

    # Pattern Detection
    pattern_monitoring_enabled: bool
    target_pattern_sts: int
    target_pattern_st: int
    target_pattern_tt: int

    # Auto-trading
    auto_trading_enabled: bool
    max_daily_trades: int
    min_market_cap: float

    # Notifications
    telegram_notifications: bool
    email_notifications: bool
    discord_notifications: bool

    created_at: datetime
    updated_at: datetime


class UserPreferencesRequest(BaseApiModel):
    """Request model for updating user preferences"""

    # Risk Management
    stop_loss_enabled: bool | None = None
    stop_loss_type: str | None = None
    stop_loss_percentage: float | None = None
    stop_loss_amount: float | None = None

    take_profit_enabled: bool | None = None
    take_profit_type: str | None = None
    take_profit_percentage: float | None = None
    take_profit_amount: float | None = None

    # Position Sizing
    default_buy_amount: float | None = None
    max_positions_per_token: int | None = None
    risk_per_trade: float | None = None

    # Pattern Detection
    pattern_monitoring_enabled: bool | None = None
    target_pattern_sts: int | None = None
    target_pattern_st: int | None = None
    target_pattern_tt: int | None = None

    # Auto-trading
    auto_trading_enabled: bool | None = None
    max_daily_trades: int | None = None
    min_market_cap: float | None = None

    # Notifications
    telegram_notifications: bool | None = None
    email_notifications: bool | None = None
    discord_notifications: bool | None = None


class ApiCredentialsRequest(BaseApiModel):
    """Request model for creating/updating API credentials"""

    provider: str  # "mexc", "binance", etc.
    api_key: str
    secret_key: str
    passphrase: str | None = None  # For some exchanges
    is_testnet: bool = False
    nickname: str | None = None
    permissions: list[str] = ["spot_trading"]


class ApiCredentialsResponse(BaseApiModel):
    """Response model for API credentials (without sensitive data)"""

    id: int
    user_id: str
    provider: str
    is_active: bool
    is_testnet: bool
    nickname: str | None
    permissions: list[str]
    has_api_key: bool  # Boolean indicator without exposing the actual key
    has_secret_key: bool  # Boolean indicator without exposing the actual secret
    created_at: datetime
    updated_at: datetime
    last_used_at: datetime | None

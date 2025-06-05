"""
Utility functions for MEXC Sniper Bot
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)


def format_timestamp(timestamp_ms: int) -> str:
    """Format timestamp in milliseconds to readable string"""
    try:
        dt = datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc)
        return dt.strftime("%Y-%m-%d %H:%M:%S UTC")
    except (ValueError, OSError):
        return "Invalid timestamp"


def calculate_time_until(target_datetime: datetime) -> dict[str, Any]:
    """Calculate time until target datetime"""
    now = datetime.now(timezone.utc)
    delta = target_datetime - now

    if delta.total_seconds() <= 0:
        return {"is_past": True, "total_seconds": 0, "hours": 0, "minutes": 0, "seconds": 0, "formatted": "Past due"}

    total_seconds = int(delta.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60

    if hours > 0:
        formatted = f"{hours}h {minutes}m {seconds}s"
    elif minutes > 0:
        formatted = f"{minutes}m {seconds}s"
    else:
        formatted = f"{seconds}s"

    return {
        "is_past": False,
        "total_seconds": total_seconds,
        "hours": hours,
        "minutes": minutes,
        "seconds": seconds,
        "formatted": formatted,
    }


def validate_mexc_symbol(symbol: str) -> bool:
    """Validate MEXC trading symbol format"""
    if not symbol or not isinstance(symbol, str):
        return False

    # Basic validation - should end with USDT and be uppercase
    return symbol.endswith("USDT") and symbol.isupper() and len(symbol) >= 5


def safe_json_loads(json_str: Optional[str], default: Any = None) -> Any:
    """Safely load JSON string with fallback"""
    if not json_str:
        return default

    try:
        return json.loads(json_str)
    except (json.JSONDecodeError, TypeError):
        logger.warning(f"Failed to parse JSON: {json_str}")
        return default


def safe_json_dumps(obj: Any, default: str = "{}") -> str:
    """Safely dump object to JSON string with fallback"""
    try:
        return json.dumps(obj)
    except (TypeError, ValueError):
        logger.warning(f"Failed to serialize to JSON: {obj}")
        return default


def calculate_advance_notice_hours(discovered_at: datetime, launch_time: datetime) -> float:
    """Calculate advance notice in hours"""
    delta = launch_time - discovered_at
    return delta.total_seconds() / 3600


def is_advance_notice_sufficient(advance_notice_hours: float, minimum_hours: float = 3.5) -> bool:
    """Check if advance notice meets minimum requirement"""
    return advance_notice_hours >= minimum_hours


def format_currency(amount: float, currency: str = "USDT") -> str:
    """Format currency amount for display"""
    if amount >= 1000:
        return f"{amount:,.2f} {currency}"

    return f"{amount:.8f} {currency}".rstrip("0").rstrip(".")


def truncate_string(text: str, max_length: int = 50) -> str:
    """Truncate string with ellipsis if too long"""
    if len(text) <= max_length:
        return text
    return text[: max_length - 3] + "..."


def get_status_emoji(status: str) -> str:
    """Get emoji for status"""
    status_emojis = {
        "monitoring": "👀",
        "ready": "🎯",
        "pending": "⏳",
        "scheduled": "📅",
        "executing": "⚡",
        "success": "✅",
        "failed": "❌",
        "cancelled": "🚫",
        "missed": "😞",
        "error": "🔥",
    }
    return status_emojis.get(status.lower(), "❓")


def format_discovery_summary(new_listings: int, ready_targets: int, scheduled_targets: int, errors: list[str]) -> str:
    """Format discovery cycle summary"""
    summary_parts = []

    if new_listings > 0:
        summary_parts.append(f"🆕 {new_listings} new listing(s)")

    if ready_targets > 0:
        summary_parts.append(f"🎯 {ready_targets} ready target(s)")

    if scheduled_targets > 0:
        summary_parts.append(f"📅 {scheduled_targets} scheduled")

    if errors:
        summary_parts.append(f"❌ {len(errors)} error(s)")

    if not summary_parts:
        return "No changes detected"

    return " | ".join(summary_parts)


async def retry_async_operation(
    operation,
    max_retries: int = 3,
    delay_seconds: float = 1.0,
    backoff_multiplier: float = 2.0,
    exceptions: tuple = (Exception,),
) -> Any:
    """Retry async operation with exponential backoff"""
    last_exception: Optional[BaseException] = None

    for attempt in range(max_retries + 1):
        try:
            return await operation()
        except exceptions as e:
            last_exception = e

            if attempt == max_retries:
                break

            wait_time = delay_seconds * (backoff_multiplier**attempt)
            logger.warning(f"Operation failed (attempt {attempt + 1}), retrying in {wait_time}s: {e}")
            await asyncio.sleep(wait_time)

    if last_exception is not None:
        raise last_exception

    raise RuntimeError("Operation failed with no exception captured")


def validate_order_params(params: dict[str, Any]) -> bool:
    """Validate order parameters"""
    required_fields = ["symbol", "side", "type"]

    # Check required fields
    for field in required_fields:
        if field not in params:
            return False

    # Validate values
    if params.get("side") not in ["BUY", "SELL"]:
        return False

    if params.get("type") not in ["MARKET", "LIMIT"]:
        return False

    # For market orders, need either quantity or quoteOrderQty
    return not (params.get("type") == "MARKET" and not (params.get("quantity") or params.get("quoteOrderQty")))


def sanitize_symbol_name(symbol: str) -> str:
    """Sanitize symbol name for safe usage"""
    if not symbol:
        return ""

    # Remove any non-alphanumeric characters except common ones
    import re

    sanitized = re.sub(r"[^A-Za-z0-9_-]", "", symbol)
    return sanitized.upper()


def get_environment_info() -> dict[str, Any]:
    """Get environment information for debugging"""
    import platform
    import sys

    return {
        "python_version": sys.version,
        "platform": platform.platform(),
        "architecture": platform.architecture(),
        "processor": platform.processor(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

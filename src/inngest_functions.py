"""
Inngest functions for MEXC Sniper Bot pattern discovery system
"""

import logging
from datetime import datetime, timezone
from typing import Any

from inngest import Context, Event, Step, TriggerCron, TriggerEvent

from .config import settings
from .database import get_async_session
from .inngest_client import inngest_client
from .services.cache_service import get_cache_service
from .services.mexc_api import get_mexc_client
from .services.pattern_discovery import get_discovery_engine

logger = logging.getLogger(__name__)


# --- Inngest Event Definitions ---


class MexcCalendarPollRequested:
    """Event for manually triggering calendar poll"""

    name = "admin.calendar.poll.requested"


class MexcNewListingDiscovered:
    """Event triggered when new listing is discovered"""

    name = "mexc.new_listing_discovered"


class MexcSymbolRecheckNeeded:
    """Event for rechecking symbol status"""

    name = "mexc.symbol_recheck_needed"


class MexcTargetReady:
    """Event triggered when target is ready for execution"""

    name = "mexc.target_ready"


# --- Inngest Functions ---


@inngest_client.create_function(
    fn_id="poll-mexc-calendar",
    trigger=[
        TriggerCron(cron=settings.CALENDAR_POLL_CRON),
        TriggerEvent(event=MexcCalendarPollRequested.name),
    ],
)
async def poll_mexc_calendar(ctx: Context, step: Step) -> dict[str, Any]:
    """
    Poll MEXC calendar for new token listings

    This function:
    1. Integrates with existing pattern discovery engine
    2. Uses enhanced MEXC API client with caching
    3. Stores results in database
    4. Handles errors gracefully
    """
    logger.info(f"Starting calendar poll - triggered by: {ctx.event.name}")

    try:
        # Step 1: Initialize services (get directly, not via step.run)
        discovery_engine = get_discovery_engine()

        # Step 2: Run calendar discovery cycle
        discovery_result = await step.run(
            "run-calendar-discovery", lambda: _run_calendar_discovery_cycle(discovery_engine)
        )

        # Step 3: Process results and trigger follow-up events
        follow_up_events = await step.run(
            "process-discovery-results", lambda: _process_discovery_results(discovery_result)
        )

        # Step 4: Send follow-up events for new listings
        if follow_up_events:
            await step.run("send-follow-up-events", lambda: _send_follow_up_events(follow_up_events))

        # Step 5: Log final results
        summary = await step.run("log-results", lambda: _log_discovery_summary(discovery_result, ctx.event.name))

        return {
            "status": "success",
            "trigger": ctx.event.name,
            "new_listings_found": discovery_result.new_listings_found,
            "ready_targets_found": discovery_result.ready_targets_found,
            "targets_scheduled": discovery_result.targets_scheduled,
            "errors": discovery_result.errors,
            "follow_up_events_sent": len(follow_up_events),
            "summary": summary,
            "timestamp": discovery_result.analysis_timestamp.isoformat(),
        }

    except Exception as e:
        error_msg = f"Calendar poll failed: {e!s}"
        logger.exception(error_msg)

        return {
            "status": "error",
            "trigger": ctx.event.name,
            "error": error_msg,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


@inngest_client.create_function(
    fn_id="watch-mexc-symbol",
    trigger=[
        TriggerEvent(event=MexcNewListingDiscovered.name),
        TriggerEvent(event=MexcSymbolRecheckNeeded.name),
    ],
)
async def watch_mexc_symbol(ctx: Context, step: Step) -> dict[str, Any]:
    """
    Watch specific MEXC symbol for ready state pattern

    This function monitors individual tokens for the ready state pattern
    and creates snipe targets when conditions are met.
    """
    vcoin_id = ctx.event.data.get("vcoin_id")
    attempt = ctx.event.data.get("attempt", 1)

    if not vcoin_id:
        error_msg = "Missing vcoin_id in event data"
        logger.error(error_msg)
        return {"status": "error", "error": error_msg}

    logger.info(f"Watching symbol for vcoin_id: {vcoin_id}, attempt: {attempt}")

    try:
        # Step 1: Get MEXC API client with caching (get directly, not via step.run)
        mexc_client = await _get_mexc_client_with_cache()

        # Step 2: Check symbol status
        symbol_status = await step.run("check-symbol-status", lambda: _check_symbol_status(mexc_client, vcoin_id))

        # Step 3: Process symbol status and create targets if ready
        result = await step.run(
            "process-symbol-status", lambda: _process_symbol_status(symbol_status, vcoin_id, attempt)
        )

        return {
            "status": "success",
            "vcoin_id": vcoin_id,
            "attempt": attempt,
            "symbol_ready": result.get("ready", False),
            "target_created": result.get("target_created", False),
            "next_check_scheduled": result.get("next_check_scheduled", False),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        error_msg = f"Symbol watch failed for {vcoin_id}: {e!s}"
        logger.exception(error_msg)

        return {
            "status": "error",
            "vcoin_id": vcoin_id,
            "attempt": attempt,
            "error": error_msg,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


# --- Helper Functions ---


async def _run_calendar_discovery_cycle(discovery_engine):
    """Run the calendar discovery cycle using existing pattern discovery engine"""
    return await discovery_engine.run_discovery_cycle()


async def _process_discovery_results(discovery_result):
    """Process discovery results and prepare follow-up events"""
    follow_up_events = []

    # For each new listing found, we should trigger symbol watching
    if discovery_result.new_listings_found > 0:
        # Get the newly discovered listings from database
        async with get_async_session() as session:
            from .database import get_monitoring_listings

            listings = await get_monitoring_listings(session)

            # Create events for newly discovered listings
            for listing in listings[-discovery_result.new_listings_found :]:
                follow_up_events.append(
                    {
                        "name": MexcNewListingDiscovered.name,
                        "data": {
                            "vcoin_id": listing.vcoin_id,
                            "symbol_name": listing.symbol_name,
                            "project_name": listing.project_name,
                            "launch_time": listing.announced_launch_datetime_utc.isoformat(),
                        },
                    }
                )

    return follow_up_events


async def _send_follow_up_events(events):
    """Send follow-up events to Inngest"""
    for event in events:
        try:
            await inngest_client.send(event)
            logger.info(f"Sent follow-up event: {event['name']} for {event['data'].get('vcoin_id')}")
        except Exception as e:
            logger.error(f"Failed to send follow-up event: {e}")


def _log_discovery_summary(discovery_result, trigger_name):
    """Log discovery summary"""
    summary = (
        f"Calendar poll complete (triggered by {trigger_name}). "
        f"Found {discovery_result.new_listings_found} new listings, "
        f"{discovery_result.ready_targets_found} ready targets, "
        f"{discovery_result.targets_scheduled} scheduled targets."
    )

    if discovery_result.errors:
        summary += f" Errors: {len(discovery_result.errors)}"

    logger.info(summary)
    return summary


async def _get_mexc_client_with_cache():
    """Get MEXC client with cache service"""
    cache_service = await get_cache_service()
    return await get_mexc_client(cache_service=cache_service)


async def _check_symbol_status(mexc_client, vcoin_id):
    """Check symbol status for specific vcoin_id"""
    symbols = await mexc_client.get_symbols_v2(vcoin_id=vcoin_id)

    for symbol in symbols:
        if symbol.matches_ready_pattern(settings.READY_STATE_PATTERN):
            return {"ready": True, "symbol": symbol, "has_complete_data": symbol.has_complete_data}

    return {"ready": False, "symbols_found": len(symbols)}


async def _process_symbol_status(symbol_status, vcoin_id, attempt):
    """Process symbol status and create targets or schedule rechecks"""
    if not symbol_status.get("ready"):
        # Symbol not ready yet, schedule recheck if not too many attempts
        if attempt < 10:  # Max 10 attempts
            event = Event(name=MexcSymbolRecheckNeeded.name, data={"vcoin_id": vcoin_id, "attempt": attempt + 1})
            await inngest_client.send(event)
            return {"next_check_scheduled": True}

        logger.warning(f"Max attempts reached for vcoin_id: {vcoin_id}")
        return {"max_attempts_reached": True}

    # Symbol is ready, create snipe target using discovery engine
    if symbol_status.get("has_complete_data"):
        discovery_engine = get_discovery_engine()

        # Use existing pattern discovery logic to create target
        async with get_async_session() as session:
            from .database import get_monitored_listing

            listing = await get_monitored_listing(session, vcoin_id)

            if listing:
                target = await discovery_engine._create_ready_target(session, listing, symbol_status["symbol"])

                if target:
                    # Send target ready event
                    await inngest_client.send(
                        Event(
                            name=MexcTargetReady.name,
                            data={
                                "target_id": target.id,
                                "vcoin_id": vcoin_id,
                                "launch_time_utc_iso": target.actual_launch_datetime_utc.isoformat(),
                            },
                        )
                    )

                    return {"target_created": True, "target_id": target.id}

    return {"ready": True, "target_created": False}


# List of all Inngest functions
inngest_functions = [
    poll_mexc_calendar,
    watch_mexc_symbol,
]

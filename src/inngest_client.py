"""
Inngest client configuration for MEXC Sniper Bot
"""

import logging

from inngest import Inngest

from .config import settings

logger = logging.getLogger(__name__)

# Initialize Inngest client
inngest_client = Inngest(
    app_id="mexc-sniper-bot",
    is_production=settings.is_production,
)

logger.info(f"Inngest client initialized for {'production' if settings.is_production else 'development'}")

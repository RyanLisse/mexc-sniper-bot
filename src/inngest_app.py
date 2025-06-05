"""
Inngest app that organizes all functions for MEXC Sniper Bot
"""
import logging

logger = logging.getLogger(__name__)

# Import all Inngest functions
try:
    from .inngest_functions import inngest_functions
    logger.info(f"Loaded {len(inngest_functions)} Inngest functions")
except ImportError as e:
    logger.warning(f"Failed to import Inngest functions: {e}")
    inngest_functions = []

# Export for Vercel integration
__all__ = ["inngest_functions"]

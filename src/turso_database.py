"""
TursoDB connection and session management for MEXC Sniper Bot
Uses libSQL for edge-hosted distributed database with SQLite compatibility
"""

import logging
import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Optional

from sqlalchemy import Engine, create_engine
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

from .config import settings

logger = logging.getLogger(__name__)

# TursoDB connection configuration
TURSO_DATABASE_URL = os.getenv("TURSO_DATABASE_URL")
TURSO_AUTH_TOKEN = os.getenv("TURSO_AUTH_TOKEN")

# Database engines
turso_engine: Optional[Engine] = None
async_turso_engine: Optional[AsyncEngine] = None
async_session_maker: Optional[async_sessionmaker] = None


def get_turso_url() -> str:
    """Get TursoDB connection URL"""
    if TURSO_DATABASE_URL and TURSO_AUTH_TOKEN:
        # Use remote TursoDB with authentication
        return f"libsql://{TURSO_DATABASE_URL}?authToken={TURSO_AUTH_TOKEN}"

    # Fallback to local SQLite-compatible database
    logger.warning("TursoDB credentials not found, using local SQLite database")
    return "sqlite+aiosqlite:///./mexc_sniper_turso.db"


def init_turso_database():
    """Initialize TursoDB engines and session makers"""
    global turso_engine, async_turso_engine, async_session_maker

    # Get connection URL
    db_url = get_turso_url()

    # For async operations, we'll use the libsql URL format
    if db_url.startswith("libsql://"):
        # TursoDB remote connection
        async_db_url = db_url.replace("libsql://", "sqlite+aiosqlite://")
    else:
        # Local SQLite
        async_db_url = db_url

    # Create sync engine for migrations
    turso_engine = create_engine(
        db_url if not db_url.startswith("libsql://") else "sqlite:///./mexc_sniper_turso.db",
        echo=settings.DEBUG,
        pool_pre_ping=True,
        connect_args={"check_same_thread": False} if "sqlite" in db_url else {},
    )

    # Create async engine for operations
    async_turso_engine = create_async_engine(
        async_db_url,
        echo=settings.DEBUG,
        future=True,
        pool_pre_ping=True,
        connect_args={"check_same_thread": False} if "sqlite" in async_db_url else {},
    )

    # Create async session maker
    async_session_maker = async_sessionmaker(async_turso_engine, class_=AsyncSession, expire_on_commit=False)

    logger.info(f"TursoDB initialized with URL: {db_url.split('?')[0]}")


async def create_turso_tables():
    """Create all database tables in TursoDB"""
    if async_turso_engine is None:
        raise RuntimeError("TursoDB not initialized. Call init_turso_database() first.")

    async with async_turso_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    logger.info("TursoDB tables created successfully")


@asynccontextmanager
async def get_turso_session() -> AsyncGenerator[AsyncSession, None]:
    """Get TursoDB async session with automatic cleanup"""
    if async_session_maker is None:
        raise RuntimeError("TursoDB not initialized. Call init_turso_database() first.")

    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def startup_turso_database():
    """Initialize TursoDB on application startup"""
    init_turso_database()
    await create_turso_tables()
    logger.info("TursoDB startup completed")


async def shutdown_turso_database():
    """Clean up TursoDB connections on application shutdown"""
    global turso_engine, async_turso_engine, async_session_maker
    from typing import cast

    if async_turso_engine is not None:
        await cast(AsyncEngine, async_turso_engine).dispose()

    if turso_engine is not None:
        cast(Engine, turso_engine).dispose()

    turso_engine = None
    async_turso_engine = None
    async_session_maker = None

    logger.info("TursoDB shutdown completed")


# For backward compatibility, expose the same interface as database.py
get_async_session = get_turso_session
startup_database = startup_turso_database
shutdown_database = shutdown_turso_database

"""
Database connection and session management for MEXC Sniper Bot
"""
import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import Session, SQLModel, create_engine, select

from .config import settings
from .models import ApiCredentials, ExecutionHistory, MonitoredListing, SnipeTarget, UserPreferences

logger = logging.getLogger(__name__)

# Database engines
engine: Optional[create_engine] = None
async_engine: Optional[create_async_engine] = None
async_session_maker: Optional[sessionmaker] = None


def init_database():
    """Initialize database engines and session makers"""
    global engine, async_engine, async_session_maker

    if not settings.database_configured:
        logger.warning("Database URL not configured. Using SQLite in-memory database for development.")
        database_url = "sqlite:///./mexc_sniper.db"
        async_database_url = "sqlite+aiosqlite:///./mexc_sniper.db"
    else:
        database_url = settings.DATABASE_URL
        # Convert PostgreSQL URL to async version if needed
        if database_url.startswith("postgresql://"):
            async_database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")
        elif database_url.startswith("postgresql+psycopg2://"):
            async_database_url = database_url.replace("postgresql+psycopg2://", "postgresql+asyncpg://")
        else:
            async_database_url = database_url

    # Create engines
    engine = create_engine(
        database_url,
        echo=settings.DEBUG,
        pool_pre_ping=True
    )

    async_engine = create_async_engine(
        async_database_url,
        echo=settings.DEBUG,
        future=True,
        pool_pre_ping=True
    )

    # Create async session maker
    async_session_maker = sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False
    )

    logger.info(f"Database initialized with URL: {database_url}")


async def create_tables():
    """Create all database tables"""
    if async_engine is None:
        raise RuntimeError("Database not initialized. Call init_database() first.")

    async with async_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    logger.info("Database tables created successfully")


async def drop_tables():
    """Drop all database tables (use with caution!)"""
    if async_engine is None:
        raise RuntimeError("Database not initialized. Call init_database() first.")

    async with async_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)

    logger.warning("All database tables dropped")


@asynccontextmanager
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """Get async database session with automatic cleanup"""
    if async_session_maker is None:
        raise RuntimeError("Database not initialized. Call init_database() first.")

    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def get_sync_session() -> Session:
    """Get synchronous database session"""
    if engine is None:
        raise RuntimeError("Database not initialized. Call init_database() first.")

    return Session(engine)


# --- Database Operations ---

async def get_monitored_listing(session: AsyncSession, vcoin_id: str) -> Optional[MonitoredListing]:
    """Get monitored listing by vcoin_id"""
    statement = select(MonitoredListing).where(MonitoredListing.vcoin_id == vcoin_id)
    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def create_monitored_listing(
    session: AsyncSession,
    vcoin_id: str,
    symbol_name: str,
    project_name: str,
    announced_launch_time_ms: int,
    announced_launch_datetime_utc
) -> MonitoredListing:
    """Create a new monitored listing"""
    listing = MonitoredListing(
        vcoin_id=vcoin_id,
        symbol_name=symbol_name,
        project_name=project_name,
        announced_launch_time_ms=announced_launch_time_ms,
        announced_launch_datetime_utc=announced_launch_datetime_utc
    )
    session.add(listing)
    await session.flush()
    await session.refresh(listing)
    return listing


async def get_snipe_target(session: AsyncSession, vcoin_id: str) -> Optional[SnipeTarget]:
    """Get snipe target by vcoin_id"""
    statement = select(SnipeTarget).where(SnipeTarget.vcoin_id == vcoin_id)
    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def get_snipe_target_by_id(session: AsyncSession, target_id: int) -> Optional[SnipeTarget]:
    """Get snipe target by ID"""
    statement = select(SnipeTarget).where(SnipeTarget.id == target_id)
    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def create_snipe_target(
    session: AsyncSession,
    vcoin_id: str,
    mexc_symbol_contract: str,
    price_precision: int,
    quantity_precision: int,
    actual_launch_time_ms: int,
    actual_launch_datetime_utc,
    discovered_at_utc,
    hours_advance_notice: float,
    intended_buy_amount_usdt: float,
    execution_order_params: dict
) -> SnipeTarget:
    """Create a new snipe target"""
    target = SnipeTarget(
        vcoin_id=vcoin_id,
        mexc_symbol_contract=mexc_symbol_contract,
        price_precision=price_precision,
        quantity_precision=quantity_precision,
        actual_launch_time_ms=actual_launch_time_ms,
        actual_launch_datetime_utc=actual_launch_datetime_utc,
        discovered_at_utc=discovered_at_utc,
        hours_advance_notice=hours_advance_notice,
        intended_buy_amount_usdt=intended_buy_amount_usdt
    )
    target.execution_order_params = execution_order_params

    session.add(target)
    await session.flush()
    await session.refresh(target)
    return target


async def update_snipe_target_status(
    session: AsyncSession,
    target_id: int,
    status: str,
    execution_response: Optional[dict] = None,
    executed_at_utc: Optional = None
) -> Optional[SnipeTarget]:
    """Update snipe target execution status"""
    target = await get_snipe_target_by_id(session, target_id)
    if target:
        target.execution_status = status
        if execution_response:
            target.execution_response = execution_response
        if executed_at_utc:
            target.executed_at_utc = executed_at_utc

        session.add(target)
        await session.flush()
        await session.refresh(target)

    return target


async def get_pending_snipe_targets(session: AsyncSession) -> list[SnipeTarget]:
    """Get all pending snipe targets"""
    statement = select(SnipeTarget).where(
        SnipeTarget.execution_status.in_(["pending", "scheduled"])
    )
    result = await session.execute(statement)
    return list(result.scalars().all())


async def get_monitoring_listings(session: AsyncSession) -> list[MonitoredListing]:
    """Get all listings currently being monitored"""
    statement = select(MonitoredListing).where(
        MonitoredListing.status == "monitoring"
    )
    result = await session.execute(statement)
    return list(result.scalars().all())


async def create_execution_history(
    session: AsyncSession,
    vcoin_id: str,
    symbol_contract: str,
    execution_timestamp,
    execution_type: str,
    buy_amount_usdt: float,
    success: bool,
    **kwargs
) -> ExecutionHistory:
    """Create execution history record"""
    history = ExecutionHistory(
        vcoin_id=vcoin_id,
        symbol_contract=symbol_contract,
        execution_timestamp=execution_timestamp,
        execution_type=execution_type,
        buy_amount_usdt=buy_amount_usdt,
        success=success,
        **kwargs
    )

    session.add(history)
    await session.flush()
    await session.refresh(history)
    return history


# --- User Preferences Operations ---

async def get_user_preferences(session: AsyncSession, user_id: str) -> Optional[UserPreferences]:
    """Get user preferences by user_id"""
    statement = select(UserPreferences).where(UserPreferences.user_id == user_id)
    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def create_user_preferences(session: AsyncSession, user_id: str, **kwargs) -> UserPreferences:
    """Create new user preferences with default values"""
    preferences = UserPreferences(user_id=user_id, **kwargs)
    session.add(preferences)
    await session.flush()
    await session.refresh(preferences)
    return preferences


async def update_user_preferences(
    session: AsyncSession,
    user_id: str,
    update_data: dict
) -> Optional[UserPreferences]:
    """Update user preferences"""
    preferences = await get_user_preferences(session, user_id)
    
    if not preferences:
        # Create new preferences if they don't exist
        preferences = await create_user_preferences(session, user_id, **update_data)
    else:
        # Update existing preferences
        for field, value in update_data.items():
            if hasattr(preferences, field) and value is not None:
                setattr(preferences, field, value)
        
        from datetime import datetime, timezone
        preferences.updated_at = datetime.now(timezone.utc)
        session.add(preferences)
        await session.flush()
        await session.refresh(preferences)
    
    return preferences


# --- API Credentials Operations ---

async def get_api_credentials(
    session: AsyncSession,
    user_id: str,
    provider: str
) -> Optional[ApiCredentials]:
    """Get API credentials by user_id and provider"""
    statement = select(ApiCredentials).where(
        ApiCredentials.user_id == user_id,
        ApiCredentials.provider == provider,
        ApiCredentials.is_active == True
    )
    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def get_all_user_credentials(session: AsyncSession, user_id: str) -> list[ApiCredentials]:
    """Get all API credentials for a user"""
    statement = select(ApiCredentials).where(ApiCredentials.user_id == user_id)
    result = await session.execute(statement)
    return list(result.scalars().all())


async def create_api_credentials(
    session: AsyncSession,
    user_id: str,
    provider: str,
    api_key_encrypted: str,
    secret_key_encrypted: str,
    passphrase_encrypted: Optional[str] = None,
    **kwargs
) -> ApiCredentials:
    """Create new API credentials"""
    # Deactivate existing credentials for the same provider
    existing = await get_api_credentials(session, user_id, provider)
    if existing:
        existing.is_active = False
        session.add(existing)
    
    credentials = ApiCredentials(
        user_id=user_id,
        provider=provider,
        api_key_encrypted=api_key_encrypted,
        secret_key_encrypted=secret_key_encrypted,
        passphrase_encrypted=passphrase_encrypted,
        **kwargs
    )
    
    session.add(credentials)
    await session.flush()
    await session.refresh(credentials)
    return credentials


async def update_api_credentials_last_used(
    session: AsyncSession,
    credentials_id: int
) -> Optional[ApiCredentials]:
    """Update the last_used_at timestamp for API credentials"""
    statement = select(ApiCredentials).where(ApiCredentials.id == credentials_id)
    result = await session.execute(statement)
    credentials = result.scalar_one_or_none()
    
    if credentials:
        from datetime import datetime, timezone
        credentials.last_used_at = datetime.now(timezone.utc)
        session.add(credentials)
        await session.flush()
        await session.refresh(credentials)
    
    return credentials


async def delete_api_credentials(
    session: AsyncSession,
    user_id: str,
    provider: str
) -> bool:
    """Delete API credentials for a user and provider"""
    credentials = await get_api_credentials(session, user_id, provider)
    if credentials:
        await session.delete(credentials)
        await session.flush()
        return True
    return False


# Database lifecycle management
async def startup_database():
    """Initialize database on application startup"""
    init_database()
    await create_tables()
    logger.info("Database startup completed")


async def shutdown_database():
    """Clean up database connections on application shutdown"""
    global engine, async_engine, async_session_maker

    if async_engine:
        await async_engine.dispose()

    if engine:
        engine.dispose()

    engine = None
    async_engine = None
    async_session_maker = None

    logger.info("Database shutdown completed")

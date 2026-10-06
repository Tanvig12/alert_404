"""Async engine/session + FastAPI lifespan + get_db."""
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.app.models import Base

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://soc:soc@db:5432/soc")

engine = create_async_engine(DATABASE_URL, pool_size=20, max_overflow=0)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield
    await engine.dispose()


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


async def init_db(url: str | None = None) -> None:
    """Create tables directly — used by tests/dev only, never app startup."""
    from sqlalchemy.ext.asyncio import create_async_engine as _mk
    eng = _mk(url or DATABASE_URL)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await eng.dispose()

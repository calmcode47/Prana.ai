"""Apply transactional backend schema migrations without starting the API or seeding data."""
import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv
from backend.database import init_db, close_db


async def migrate():
    if not os.getenv("DATABASE_URL"):
        raise RuntimeError("DATABASE_URL is required for migrations")
    try:
        if not await init_db():
            raise RuntimeError("Migration requires PostgreSQL/PostGIS")
    finally:
        await close_db()


if __name__ == "__main__":
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    try:
        asyncio.run(migrate())
    except Exception as exc:
        print(f"Database migration failed ({type(exc).__name__}); check database configuration.")
        raise SystemExit(1)
    print("PostgreSQL/PostGIS schema migrations completed.")

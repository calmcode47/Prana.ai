"""Runtime modes: explicit demo data locally, strict dependencies in production."""
import os


def production_mode() -> bool:
    return os.getenv("PRANA_ENV", "development").lower() == "production"


def demo_enabled() -> bool:
    return os.getenv("PRANA_DEMO_MODE", "false" if production_mode() else "true").lower() == "true"


def scheduler_enabled() -> bool:
    return os.getenv("PRANA_SCHEDULER_ENABLED", "true").lower() == "true"

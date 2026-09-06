"""
Unit Tests for Pre-Flight Production Readiness (SESSION-006)
Verifies environment, static asset, ML sanity, and readiness execution.
"""

import pytest
from backend.scripts.preflight_check import PreflightChecker


@pytest.mark.asyncio
async def test_preflight_readiness_passes():
    checker = PreflightChecker()
    await checker.check_environment()
    await checker.check_database()
    checker.check_static_assets()
    checker.check_ml_sanity()
    
    assert checker.critical_failures == 0
    assert len(checker.results) >= 10

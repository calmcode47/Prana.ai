"""Authentication helpers for operator-only control-plane routes."""
import hmac
import os

from fastapi import HTTPException, Request


def require_operator(request: Request) -> None:
    """Require the server-side operator secret via Bearer or X-API-Key."""
    expected = os.getenv("PRANA_OPERATOR_API_KEY", "")
    if not expected:
        raise HTTPException(503, "Operator authentication is not configured")

    authorization = request.headers.get("authorization", "")
    bearer = authorization[7:].strip() if authorization.lower().startswith("bearer ") else ""
    api_key = request.headers.get("x-api-key", "")
    if not any(value and hmac.compare_digest(value, expected) for value in (bearer, api_key)):
        raise HTTPException(401, "Valid operator authentication is required")

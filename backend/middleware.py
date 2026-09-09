"""Limit request bodies before application parsers buffer them."""
from starlette.responses import JSONResponse
from starlette.exceptions import HTTPException


class UploadLimitMiddleware:
    # Allow multipart headers in addition to the 5 MiB image limit.
    photo_max_body = 5 * 1024 * 1024 + 64 * 1024
    json_max_body = 256 * 1024

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        is_photo = scope["path"] == "/api/v1/citizen/photo"
        max_body = self.photo_max_body if is_photo else self.json_max_body
        headers = dict(scope.get("headers", []))
        try:
            size = int(headers.get(b"content-length", b"0"))
            if size < 0:
                raise ValueError
        except ValueError:
            return await JSONResponse({"detail": "Invalid Content-Length"}, 400)(scope, receive, send)
        if size > max_body:
            detail = "File too large. Maximum 5MB." if is_photo else "Request body too large. Maximum 256KB."
            return await JSONResponse({"detail": detail}, 413)(scope, receive, send)
        received = 0

        async def limited_receive():
            nonlocal received
            message = await receive()
            received += len(message.get("body", b""))
            if received > max_body:
                detail = "File too large. Maximum 5MB." if is_photo else "Request body too large. Maximum 256KB."
                raise HTTPException(413, detail)
            return message

        await self.app(scope, limited_receive, send)

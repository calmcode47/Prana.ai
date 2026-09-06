"""Limit upload bodies before the multipart parser buffers them."""
from starlette.responses import JSONResponse
from starlette.exceptions import HTTPException


class UploadLimitMiddleware:
    # Allow multipart headers in addition to the 5 MiB image limit.
    max_body = 5 * 1024 * 1024 + 64 * 1024

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["path"] != "/api/v1/citizen/photo":
            return await self.app(scope, receive, send)
        headers = dict(scope.get("headers", []))
        try:
            size = int(headers.get(b"content-length", b"0"))
            if size < 0:
                raise ValueError
        except ValueError:
            return await JSONResponse({"detail": "Invalid Content-Length"}, 400)(scope, receive, send)
        if size > self.max_body:
            return await JSONResponse({"detail": "File too large. Maximum 5MB."}, 413)(scope, receive, send)
        received = 0

        async def limited_receive():
            nonlocal received
            message = await receive()
            received += len(message.get("body", b""))
            if received > self.max_body:
                raise HTTPException(413, "File too large. Maximum 5MB.")
            return message

        await self.app(scope, limited_receive, send)

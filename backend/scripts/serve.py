"""Single-process API with shared scheduler, rate limits and WebSocket subscriptions."""
import os
import uvicorn
from pathlib import Path
from dotenv import load_dotenv

if __name__ == "__main__":
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    uvicorn.run("backend.main:app", host=os.getenv("HOST", "127.0.0.1"),
                port=int(os.getenv("PORT", "8000")), workers=1)

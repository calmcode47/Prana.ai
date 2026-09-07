"""Exercise production mode over verified loopback HTTPS/WSS, keeping artifacts in the repo."""
import asyncio
import ipaddress
import json
import os
from pathlib import Path
import socket
import ssl
import subprocess
import sys
import time
from datetime import datetime, timezone, timedelta
from urllib.parse import urlsplit

import httpx
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

from backend.scripts.verify_deployment import verify

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / ".local" / "production-verification"


def certificate(directory):
    """Private test certificate, trusted only by this process; never installed system-wide."""
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "PRANA loopback verification")])
    now = datetime.now(timezone.utc)
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
            .serial_number(x509.random_serial_number()).not_valid_before(now - timedelta(minutes=1))
            .not_valid_after(now + timedelta(days=1))
            .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
            .add_extension(x509.SubjectAlternativeName([x509.IPAddress(ipaddress.ip_address("127.0.0.1"))]),
                           critical=False).sign(key, hashes.SHA256()))
    cert_file, key_file = directory / "loopback-cert.pem", directory / "loopback-key.pem"
    cert_file.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    key_file.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                          serialization.NoEncryption()))
    return cert_file, key_file


def run():
    url = os.getenv("PRANA_TEST_DATABASE_URL", "")
    if not urlsplit(url).path.endswith("_test"):
        raise ValueError("PRANA_TEST_DATABASE_URL must name a dedicated database ending in _test")
    # Resolve before writing, including any pre-existing symlinks/junctions.
    if not ARTIFACTS.resolve().is_relative_to(ROOT.resolve()):
        raise ValueError("Verification artifacts must remain inside the repository")
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    temporary = ARTIFACTS / "tmp"
    temporary.mkdir(exist_ok=True)
    cert_file, key_file = certificate(ARTIFACTS)
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    origin = f"https://127.0.0.1:{port}"
    env = {**os.environ, "DATABASE_URL": url, "PRANA_ENV": "production", "PRANA_DEMO_MODE": "false",
           "PRANA_SCHEDULER_ENABLED": "false", "CORS_ORIGINS": origin,
           "FIRMS_MAP_KEY": "", "OPENAQ_API_KEY": "",
           "TEMP": str(temporary), "TMP": str(temporary), "TMPDIR": str(temporary),
           "PYTHONDONTWRITEBYTECODE": "1"}
    args = [sys.executable, "-B", "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1",
            "--port", str(port), "--workers", "1", "--ssl-certfile", str(cert_file),
            "--ssl-keyfile", str(key_file)]
    tls = ssl.create_default_context(cafile=str(cert_file))
    with (ARTIFACTS / "server.log").open("w", encoding="utf-8") as log:
        process = subprocess.Popen(args, cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT,
                                   creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
        try:
            deadline = time.monotonic() + 45
            with httpx.Client(verify=tls, timeout=3, trust_env=False) as client:
                while True:
                    if process.poll() is not None:
                        raise RuntimeError("Production process failed to start; see the repository-local server log")
                    try:
                        if client.get(origin + "/ready").status_code == 200:
                            break
                    except httpx.HTTPError:
                        pass
                    if time.monotonic() >= deadline:
                        raise TimeoutError("Production startup timed out")
                    time.sleep(0.2)
                report = asyncio.run(verify(origin, ca_file=cert_file))
                checks = report["checks"]
                # Default system trust must reject our temporary, untrusted certificate.
                try:
                    with httpx.Client(timeout=3, trust_env=False) as untrusted:
                        untrusted.get(origin + "/health")
                except httpx.ConnectError:
                    checks.append({"check": "untrusted_certificate_rejected", "status": "passed"})
                else:
                    checks.append({"check": "untrusted_certificate_rejected", "status": "failed"})
                for path in ("/api/v1/aqi/surface", "/api/v1/forecast/plume"):
                    response = client.get(origin + path, timeout=30)
                    checks.append({"check": path + " without provider credentials", "status":
                                   "passed" if response.status_code == 503 else "failed"})
                for request_origin, expected in ((origin, origin), ("https://unapproved.invalid", None)):
                    response = client.get(origin + "/health", headers={"Origin": request_origin})
                    checks.append({"check": "cors_allowed" if expected else "cors_unapproved",
                                   "status": "passed" if response.headers.get("access-control-allow-origin") == expected else "failed"})
                report.update(scope="local production-mode test; no public deployment",
                              certificate_trust="temporary explicit CA; system trust unchanged")
                (ARTIFACTS / "report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
                return report
        finally:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=10)


if __name__ == "__main__":
    try:
        result = run()
    except Exception as exc:
        print(f"Local production verification failed ({type(exc).__name__}). Set PRANA_TEST_DATABASE_URL and inspect .local/production-verification.")
        raise SystemExit(1)
    print(json.dumps(result, indent=2))
    raise SystemExit(int(any(row["status"] != "passed" for row in result["checks"])))

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const mobileRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(mobileRoot, '..');
const backendHealth = 'http://127.0.0.1:8000/health';
let backendProcess = null;
let expoProcess = null;
let closing = false;

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function backendIsReady() {
  try {
    const response = await fetch(backendHealth, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureBackend() {
  if (await backendIsReady()) return;
  const candidates = process.platform === 'win32'
    ? [path.join(projectRoot, 'backend', '.venv', 'Scripts', 'python.exe')]
    : [path.join(projectRoot, 'backend', '.venv', 'bin', 'python'), 'python3'];
  const python = candidates.find((candidate) => candidate === 'python3' || fs.existsSync(candidate));
  if (!python) throw new Error('Backend environment not found. Create backend/.venv first.');

  backendProcess = spawn(python, ['-m', 'backend.scripts.serve'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, HOST: '127.0.0.1', PORT: '8000' },
  });
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await backendIsReady()) return;
    await delay(500);
  }
  throw new Error('Backend did not become healthy on port 8000.');
}

function cleanup(exitCode = 0) {
  if (closing) return;
  closing = true;
  if (expoProcess && !expoProcess.killed) expoProcess.kill();
  if (backendProcess && !backendProcess.killed) backendProcess.kill();
  process.exit(exitCode);
}

async function main() {
  await ensureBackend();
  const expoCli = path.join(mobileRoot, 'node_modules', 'expo', 'bin', 'cli');
  console.log('Starting Expo tunnel with the backend available at /prana-api on the same public address.');
  expoProcess = spawn(process.execPath, [expoCli, 'start', '--tunnel', '--port', '8081'], {
    cwd: mobileRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      // The tunnel build derives its public API address from Expo hostUri. Do
      // not let the local-Wi-Fi value in .env override that address.
      EXPO_PUBLIC_API_URL: '',
      EXPO_NO_DOTENV: '1',
    },
  });
  expoProcess.on('exit', (code) => cleanup(code || 0));
}

process.on('SIGINT', () => cleanup(0));
process.on('SIGTERM', () => cleanup(0));
main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  cleanup(1);
});

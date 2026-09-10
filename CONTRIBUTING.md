# Contributing to PRANA

Thank you for contributing. Keep changes focused, document data provenance, and never commit credentials, private keys, personal data, or production environment files.

## Project rules

- Runtime screens must use backend or provider responses. Do not add mock, sample, randomized, or silently substituted values to user-visible production paths.
- When real data is unavailable, show a clear unavailable or N/A state.
- Preserve the established frontend visual design, layout, styling, and animations unless a design change is explicitly requested.
- Legal notices, signatures, dispatches, model outputs, and source labels must describe what the system actually performed.
- Demonstration fixtures must remain explicitly enabled, clearly labeled, and disabled in production.

## Before opening a pull request

Run these checks from the repository root:

```text
python -m pytest backend/tests -m "not integration" --tb=short -q
cd web && npm ci && npm run build && npm test -- --run && cd ..
cd mobile-app && npm ci && npx tsc --noEmit && npm test -- --runInBand && cd ..
```

Explain any skipped check in the pull request. New behavior should include tests, and public-facing claims should identify whether data is observed, modeled, historical, or unavailable.

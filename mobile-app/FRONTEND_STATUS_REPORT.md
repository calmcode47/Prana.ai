# PRANA Air — Mobile Frontend Status & Roadmap Report

**Date of Report:** 9 September 2026  
**Audited Subsystem:** `mobile-app/` (React Native 0.86.3, Expo SDK 52/57, TypeScript)  
**Verification Status:** All 6 screens operational; 42 Jest unit/screen tests passing; TypeScript 0 errors.

---

## 1. What Has Been Completed & Verified

The mobile frontend is fully functional and connected to the FastAPI backend. Key features delivered:

1. **All 6 Interactive Screens Implemented**:
   - **Airshed Dashboard** ([`AirshedDashboardScreen.tsx`](file:///Users/mayank/Documents/Workspace/Prana.ai/mobile-app/src/screens/AirshedDashboardScreen.tsx)): Real-time regional telemetry, station inspector, FRP summary, live WebSocket connection (`/ws/live`).
   - **Air Corridor Map** ([`AirCorridorMapScreen.tsx`](file:///Users/mayank/Documents/Workspace/Prana.ai/mobile-app/src/screens/AirCorridorMapScreen.tsx)): Interactive pan & zoom, ambient continuous advection particles, 72h forward advection scrubber, regional node telemetries.
   - **Plume Forecast** ([`PlumeForecastScreen.tsx`](file:///Users/mayank/Documents/Workspace/Prana.ai/mobile-app/src/screens/PlumeForecastScreen.tsx)): Gaussian-plume trajectory viewer (24h, 48h, 72h), active DBSCAN cluster envelopes, emergency incident dispatch.
   - **Federated Mesh** ([`FederatedMeshScreen.tsx`](file:///Users/mayank/Documents/Workspace/Prana.ai/mobile-app/src/screens/FederatedMeshScreen.tsx)): Differential privacy metrics ($\varepsilon, \delta$), convergence trajectory charts, manual simulation trigger.
   - **Regulatory Alerts** ([`RegulatoryAlertsScreen.tsx`](file:///Users/mayank/Documents/Workspace/Prana.ai/mobile-app/src/screens/RegulatoryAlertsScreen.tsx)): Multilingual advisories (EN, हिन्दी, ਪੰਜਾਬੀ), Section 31A Air Act notice generator, SHA-256 evidence verification.
   - **Sky Haze Scanner** ([`CitizenScannerScreen.tsx`](file:///Users/mayank/Documents/Workspace/Prana.ai/mobile-app/src/screens/CitizenScannerScreen.tsx)): Hardware GPS integration, camera capture, photo gallery selection, Dark Channel Prior (DCP) optical depth inference.
2. **Citizen Photo Upload Mechanism Fixed**:
   - Resolved Expo WinterCG `Unsupported FormDataPart implementation` using in-memory binary serialization (`bytes: async () => Uint8Array`) with automatic `XMLHttpRequest` fallback for native file URIs.
3. **Automated Testing Suite**:
   - 42 Jest unit and integration tests passing (`npm test`), covering UI components, screens, CPCB AQI math, and API error resilience.
4. **Resilient Offline Architecture**:
   - Automatic HTTP request caching via AsyncStorage, offline network status banner, and graceful degraded states.
5. **Audio Intelligence**:
   - Floating audio briefing player (`FloatingAudioPlayer.tsx`) connected to backend RSS/audio feed (`/api/v1/briefings/latest`) with native background playback.

---

## 2. What Is Left (Pending & Next-Phase Roadmap)

While the application is complete and functional for development and live demonstration, the following items represent the remaining tasks to achieve full enterprise app-store production deployment:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       REMAINING FRONTEND WORKSTREAMS                        │
├───────────────────────┬─────────────────────────┬───────────────────────────┤
│ 1. Production Native  │ 2. Real-World Push      │ 3. User Personalization   │
│    Builds (EAS)       │    Credentials          │    & Persistent Settings  │
├───────────────────────┼─────────────────────────┼───────────────────────────┤
│ 4. Native MapLibre    │ 5. High-Contrast Dark   │ 6. End-to-End Device      │
│    Cartography (Opt.) │    Mode (Night Field)   │    Testing (Maestro)      │
└───────────────────────┴─────────────────────────┴───────────────────────────┘
```

---

### Workstream 1: Production Native Builds & EAS Pipeline

* **Current Status**:
  * `eas.json` is configured for development, preview, and production builds.
  * No release binary is checked into source control. Use an authenticated EAS production build and publish the signed artifact through the selected release host.
* **What is Left**:
  * **Execute EAS Cloud Builds**: Run `eas build --platform android --profile production` (generates signed `.aab`/`.apk`) and `eas build --platform ios --profile production` (generates signed `.ipa`). *Requires active Expo Application Services login and Apple/Google developer credentials.*
  * **Link Binary to Release Endpoint**: Host the resulting APK/IPA on a CDN/S3 bucket and update the backend's `/api/v1/operations/mobile/releases/latest` configuration so real OTA update downloads work.

---

### Workstream 2: Native Push Notification Credentials

* **Current Status**:
  * In-app alert queue and real-time WebSocket alert popups are fully operational.
  * Notification permission request and channel setup (`prana-alerts`) are implemented in [`notifications.ts`](file:///Users/mayank/Documents/Workspace/Prana.ai/mobile-app/src/services/notifications.ts).
* **What is Left**:
  * **Configure EAS Project ID**: Set `EXPO_PUBLIC_EAS_PROJECT_ID` in `mobile-app/.env` with your real Expo project ID.
  * **Apple Push Notification Service (APNs)**: Upload an APNs Key (`.p8`) to the Apple Developer Console for background iOS pushes.
  * **Firebase Cloud Messaging (FCM)**: Configure the real Android push credential through EAS credentials (or place `google-services.json` locally when required). The file is ignored and must not be committed.

---

### Workstream 3: User Personalization & Persistent Settings

* **Current Status**:
  * Filter states, selected language, and active stations currently reside in React component state and reset upon app reload.
* **What is Left**:
  * **Settings / Preferences Store**: Persist user choices via `@react-native-async-storage/async-storage`:
    * Preferred default corridor node (e.g., automatically open *Anand Vihar* or *Sangrur* on launch).
    * Persistent language choice (**EN**, **हिन्दी**, **ਪੰਜਾਬੀ**) across all screens.
    * Custom AQI alert thresholds (e.g., alert only when PM2.5 > 250 µg/m³).
    * Fahrenheit vs Celsius or Imperial vs Metric toggles.

---

### Workstream 4: Native MapLibre Cartography (DEC-008 Optional Enhancement)

* **Current Status**:
  * The corridor flow map uses `react-native-svg` with interactive pan, zoom controls, and animated advection particles. This was deliberately chosen to preserve 100% zero-dependency Expo Go portability without native compilation.
* **What is Left (Optional)**:
  * If the team desires full native OpenGL/Metal GIS cartography (satellite raster imagery, 3D terrain elevation, and Mapbox GL vector tile pinch-to-rotate):
    * Run `npx expo prebuild` to generate native iOS/Android projects.
    * Install `@maplibre/maplibre-react-native`.
    * *Note: This will require native development builds and drops standard Expo Go compatibility.*

---

### Workstream 5: High-Contrast Dark Mode (Field Night Inspection)

* **Current Status**:
  * The app uses an Atmospheric Intelligence neo-brutalist palette (`canvasCream`, `inkBlack`, `surfaceVanilla`, `terracottaDeep`).
* **What is Left**:
  * Add a Dark Mode theme definition in [`tokens.ts`](file:///Users/mayank/Documents/Workspace/Prana.ai/mobile-app/src/theme/tokens.ts) (`canvasOnyx`, `surfaceObsidian`, `inkWhite`, neon glow accents) to accommodate nocturnal agricultural burning field inspections and reduce battery drain on OLED devices.

---

### Workstream 6: End-to-End (E2E) Device Testing

* **Current Status**:
  * 42 unit & integration tests run via Jest + React Native Testing Library.
* **What is Left**:
  * Add Maestro or Detox E2E flows simulating user interactions on real simulators:
    * Take a photo $\to$ Run DCP optical depth inference $\to$ Verify result badge.
    * Open Air Corridor Map $\to$ Zoom in to 2x $\to$ Select node $\to$ Verify inspector values update.
    * Tap alert $\to$ Draft Section 31A notice $\to$ Confirm notice added to ledger.

---

## 3. Recommended Action Plan

If you want to continue refining the frontend, here is the recommended sequence:

1. **Immediate Quick Win**: Add persistent user preferences (language, default node, alert threshold) via AsyncStorage so user selections survive app restarts.
2. **Visual Enhancement**: Implement Dark Mode theme switcher for field inspection.
3. **Production Deployment**: Build the native signed release binaries (`.apk` / `.ipa`) via EAS and link them to the download prompt.

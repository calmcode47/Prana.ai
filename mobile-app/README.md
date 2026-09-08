# PRANA Air — Mobile Frontend App (Expo SDK 57)

This is the mobile application for **PRANA Air**, designed for both **iOS and Android**, matching the **Atmospheric Intelligence Audio-Visual** design system specified in `frontend-essentials/mobile-design/`.

Compatible with **Expo Go version 57.0.9**.

---

## Getting Started

### 1. Prerequisites
- Node.js `>= 20.19.4` (e.g. Node 22)
- Expo Go app on iOS or Android (Version 57.0.9)

### 2. Start the Development Server
```bash
cd mobile-app
npx expo start
```
Then scan the QR code displayed in the terminal with:
* **Android**: The Expo Go app (v57.0.9).
* **iOS**: The default Camera app to open in Expo Go.

The app derives the backend address from the Expo development host. For a physical phone or a separately hosted API, copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to an address the device can reach.

---

## Screen Architecture

All six screens preserve the supplied visual design and load measurements from the FastAPI backend. Failed requests produce explicit unavailable states; the app does not substitute demonstration measurements.

1. **Airshed Dashboard** (`src/screens/AirshedDashboardScreen.tsx`):
   * Location selector (`Anand Vihar, DL`) and tilted `72H SMOG WATCH` starburst sticker.
   * Curated search & filter pill bar (`✦ For you`, `Stubble Fires`, `Wind Vectors`).
   * Current NASA FIRMS hotspot count, Open-Meteo wind and mixing height, backend PM2.5 surface, and nearest OpenAQ observation.
   * Regional fire-radiative-power summaries and measured lag-analysis availability.
   * Enforcement controls create a real incident before drafting or dispatching.
   * Floating camera action button (`+ Analyse Sky Haze`).

2. **Air Corridor Trajectory Map** (`src/screens/AirCorridorMapScreen.tsx`):
   * Full interactive SVG map canvas with dot-grid pattern, topographic contour waves, and NW-to-SE smoke swath.
   * Animated wind vector streamlines.
   * Interactive trajectory nodes: Sangrur (🔥), Patiala, Karnal, Panipat, and Delhi NCR Basin.
   * Geospatial layer switcher (`FRP Hotspots`, `GPR PM2.5 Grid`, `Plume Swath`).
   * Inspector values are derived from the current backend surface, fire, weather, and SensorThings responses.

3. **72-Hour Plume Forecast & Scrubber** (`src/screens/PlumeForecastScreen.tsx`):
   * Backend forecast envelopes at 24, 48, and 72 hours with their stated model assumptions.
   * Interactive timeline viewer and live Open-Meteo boundary-layer inputs.
   * Surface-grid values are labeled by their actual coordinates rather than invented ward assignments.

4. **Cross-Border Federated Mesh** (`src/screens/FederatedMeshScreen.tsx`):
   * Reports the backend's actual privacy configuration and identifies the synthetic corridor dataset.
   * Decentralized node topology cards for the local Punjab and Delhi simulation partitions.
   * Animated SVG convergence spine connecting nodes down to central aggregator ring.
   * Federated runs and charts use only backend-returned round results.

5. **Regulatory Enforcement & Alerts** (`src/screens/RegulatoryAlertsScreen.tsx`):
   * Current fire, nighttime-anomaly, incident, notice, dispatch, and CEMS data.
   * Multilingual advisory toggle pills (**EN**, **हिन्दी**, **ਪੰਜਾਬੀ**) with dynamic bulletin translation.
   * Incident cards and satellite evidence render only records returned by the backend.
   * Notice, signature-package, and dispatch failures remain failures in the UI.

6. **Citizen Sky Haze Estimator** (`src/screens/CitizenScannerScreen.tsx`):
   * Camera capture and photo-library selection using Expo Image Picker.
   * The selected image and coordinates are uploaded to the backend DCP estimator.
   * Results show only API-returned PM2.5, AQI, confidence, and processing time.
   * Practical citizen health protection checklist (N95 mask, HEPA purifier, morning cardio suspension).

---

## Key Components & Design System

* `src/theme/tokens.ts`: Master color palette (`canvasCream`, `surfaceVanilla`, `inkBlack`, `cobaltDeep`, `coralWatermelon`, `terracottaDeep`, `forestJade`), typography, and neo-brutalist shadow scales.
* `src/components/NeoCard.tsx`: Neo-brutalist card container with solid 1.5px/2px ink border and hard offset shadows.
* `src/components/NeoButton.tsx`: Tactile button with animated click down-translation (`(x: 2, y: 2)`) and shadow collapse.
* `src/components/DualUnitChip.tsx`: Dual-unit telemetry badge displaying both mass concentrations ($\mu\text{g/m}^3$) and regulatory AQI indexes.
* `src/components/FloatingAudioPlayer.tsx`: Docked briefing tray. It displays current backend scripts and only offers audio playback when an audio URL exists.
* `src/components/BottomNavBar.tsx`: Floating pill bottom navigation bar with 5 destinations.

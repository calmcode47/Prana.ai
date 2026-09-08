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

---

## Screen Architecture

All 6 screens from `frontend-essentials/mobile-design` are fully implemented:

1. **Airshed Dashboard** (`src/screens/AirshedDashboardScreen.tsx`):
   * Location selector (`Anand Vihar, DL`) and tilted `72H SMOG WATCH` starburst sticker.
   * Curated search & filter pill bar (`✦ For you`, `Stubble Fires`, `Wind Vectors`).
   * Live stubble fire dispatch marquee banner (`247 Active Stubble Fires`).
   * **AirShed Node 04 Hero Card**: Custom SVG illustration of the atmospheric observer with blooming sensor antennae, NW corridor wind badge, and `AQI 387 • SEVERE` pill.
   * Dual-unit telemetry pills (`48.2 µg/m³ PM2.5 | AQI 162 Moderate`, `124 µg/m³ PM10 | AQI 387 Severe`).
   * Floating camera action button (`+ Analyse Sky Haze`).

2. **Air Corridor Trajectory Map** (`src/screens/AirCorridorMapScreen.tsx`):
   * Full interactive SVG map canvas with dot-grid pattern, topographic contour waves, and NW-to-SE smoke swath.
   * Animated wind vector streamlines.
   * Interactive trajectory nodes: Sangrur (🔥), Patiala, Karnal, Panipat, and Delhi NCR Basin.
   * Geospatial layer switcher (`FRP Hotspots`, `GPR PM2.5 Grid`, `Plume Swath`).
   * Live Inspector Drawer card displaying localized PM2.5, wind velocity, and arrival lag when a node is tapped.

3. **72-Hour Plume Forecast & Scrubber** (`src/screens/PlumeForecastScreen.tsx`):
   * Inversion Trajectory Hero Card with `AIR WARM` starburst badge.
   * Interactive timeline scrubber (Hour 0 to Hour 72) with draggable playhead and smooth auto-play simulation.
   * Boundary Physics Bento diagnostics:
     * *BL Mixing Height* (thermal lid compression at 340m AGL).
     * *Stagnation Lock* (ventilation index warning).
     * *Thermal Inversion Strength* (+4.2°C gradient aloft).

4. **Cross-Border Federated Mesh** (`src/screens/FederatedMeshScreen.tsx`):
   * Zero-Knowledge gradient aggregation guarantee banner with Differential Privacy ($\epsilon = 1.2$).
   * Scheduled dispatch ticker (`03:45 UTC`).
   * Decentralized node topology cards for Punjab (agricultural samples) and Delhi (urban samples).
   * Animated SVG convergence spine connecting nodes down to central aggregator ring.
   * Interactive Federated Training simulation button with live round and loss progression.
   * Cross-state model accuracy gains chart (Global FedAvg: 91.4%).

5. **Regulatory Enforcement & Alerts** (`src/screens/RegulatoryAlertsScreen.tsx`):
   * Top 3 telemetry stat cards: *Active Fires (24)*, *Inversions (05)*, *SPCB Dockets (12)*.
   * Multilingual advisory toggle pills (**EN**, **हिन्दी**, **ਪੰਜਾਬੀ**) with dynamic bulletin translation.
   * Active enforcement stream cards with emergency badges (`Anand Vihar Corridor Breach`).
   * Sentinel-5P thermal band satellite evidence preview.
   * Statutory Section 31A Show-Cause Notice drafting action.

6. **Citizen Sky Haze Estimator** (`src/screens/CitizenScannerScreen.tsx`):
   * Camera viewfinder with reticle crosshairs, horizon guidance line, live sun elevation, and GPS coordinates.
   * Retro capture toolbar with *"Take Photo"* and *"Sample Optic"*.
   * Tactile *"Analyse Haze (EfficientNet-B0 + DCP)"* trigger button.
   * 1.8s instant inference result card (PM2.5 312 µg/m³, AQI 378 Severe, $\beta_{ext}$ extinction coefficient).
   * Practical citizen health protection checklist (N95 mask, HEPA purifier, morning cardio suspension).

---

## Key Components & Design System

* `src/theme/tokens.ts`: Master color palette (`canvasCream`, `surfaceVanilla`, `inkBlack`, `cobaltDeep`, `coralWatermelon`, `terracottaDeep`, `forestJade`), typography, and neo-brutalist shadow scales.
* `src/components/NeoCard.tsx`: Neo-brutalist card container with solid 1.5px/2px ink border and hard offset shadows.
* `src/components/NeoButton.tsx`: Tactile button with animated click down-translation (`(x: 2, y: 2)`) and shadow collapse.
* `src/components/DualUnitChip.tsx`: Dual-unit telemetry badge displaying both mass concentrations ($\mu\text{g/m}^3$) and regulatory AQI indexes.
* `src/components/FloatingAudioPlayer.tsx`: Docked audio tray with animated equalizer waveform bars and live play/pause controls.
* `src/components/BottomNavBar.tsx`: Floating pill bottom navigation bar with 5 destinations.

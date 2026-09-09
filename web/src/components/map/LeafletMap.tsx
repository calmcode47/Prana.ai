import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getAqiCategoryAndColor } from '../../api/client';

export interface MapStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  pm25?: number | null;
  aqi?: number | null;
  source?: string;
}

export interface MapHotspot {
  lat: number;
  lon: number;
  frp?: number;
  confidence?: string;
  acq_date?: string;
}

export interface MapPlumePolygon {
  clusterId?: string;
  horizonHours: number;
  coordinates: [number, number][]; // [lon, lat]
  avgPm25?: number;
  label?: string;
}

export interface MapSurfacePoint {
  lat: number;
  lon: number;
  pm25: number;
  aqi?: number;
}

export interface LeafletMapProps {
  center?: [number, number]; // [lat, lon]
  zoom?: number;
  height?: string | number;
  stations?: MapStation[];
  hotspots?: MapHotspot[];
  plumes?: MapPlumePolygon[];
  surfacePoints?: MapSurfacePoint[];
  showHotspots?: boolean;
  showStations?: boolean;
  showPlumes?: boolean;
  showSurface?: boolean;
  selectedStationId?: string;
  onSelectStation?: (id: string) => void;
  className?: string;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  center = [29.6, 76.8], // Default to Punjab-Delhi Corridor center
  zoom = 7,
  height = 420,
  stations = [],
  hotspots = [],
  plumes = [],
  surfacePoints = [],
  showHotspots = true,
  showStations = true,
  showPlumes = true,
  showSurface = true,
  selectedStationId,
  onSelectStation,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{
    stationsLayer: L.LayerGroup;
    hotspotsLayer: L.LayerGroup;
    plumesLayer: L.LayerGroup;
    surfaceLayer: L.LayerGroup;
  } | null>(null);

  // Initialize map instance
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: false,
    });

    // Warm carto tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
      subdomains: 'abcd',
    }).addTo(map);

    const stationsLayer = L.layerGroup().addTo(map);
    const hotspotsLayer = L.layerGroup().addTo(map);
    const plumesLayer = L.layerGroup().addTo(map);
    const surfaceLayer = L.layerGroup().addTo(map);

    layersRef.current = {
      stationsLayer,
      hotspotsLayer,
      plumesLayer,
      surfaceLayer,
    };

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      layersRef.current = null;
    };
  }, []);

  // Update Surface Grid Layer
  useEffect(() => {
    if (!layersRef.current) return;
    const { surfaceLayer } = layersRef.current;
    surfaceLayer.clearLayers();

    if (!showSurface || surfacePoints.length === 0) return;

    surfacePoints.forEach((point) => {
      const aqi = point.aqi ?? Math.round(point.pm25 * 1.6);
      const { color } = getAqiCategoryAndColor(aqi);

      const circle = L.circle([point.lat, point.lon], {
        radius: 12000, // 12km grid interpolation
        color: color,
        fillColor: color,
        fillOpacity: 0.28,
        weight: 1,
        opacity: 0.5,
      });

      circle.bindTooltip(
        `<strong>PM2.5: ${point.pm25.toFixed(1)} µg/m³</strong><br/>AQI Estimate: ${aqi}`,
        { sticky: true }
      );

      circle.addTo(surfaceLayer);
    });
  }, [surfacePoints, showSurface]);

  // Update Plumes Layer
  useEffect(() => {
    if (!layersRef.current) return;
    const { plumesLayer } = layersRef.current;
    plumesLayer.clearLayers();

    if (!showPlumes || plumes.length === 0) return;

    plumes.forEach((plume) => {
      // coordinates are [lon, lat], Leaflet expects [lat, lon]
      const latLngs = plume.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]);
      if (latLngs.length < 3) return;

      const horizonColor =
        plume.horizonHours <= 24
          ? '#EA580C' // 24h: terracotta
          : plume.horizonHours <= 48
          ? '#FF5376' // 48h: vivid watermelon
          : '#7C2D12'; // 72h: hazardous deep

      const polygon = L.polygon(latLngs, {
        color: horizonColor,
        weight: 2,
        dashArray: plume.horizonHours > 24 ? '6 4' : undefined,
        fillColor: horizonColor,
        fillOpacity: 0.25,
      });

      polygon.bindPopup(
        `<div style="font-family: Plus Jakarta Sans, sans-serif;">
          <h4 style="margin:0 0 4px; font-weight:700; color:#18181B;">
            ${plume.label || `${plume.horizonHours}h Gaussian Plume Dispersion`}
          </h4>
          <p style="margin:0; font-size:12px; color:#52525B;">
            Cluster: <b>${plume.clusterId || 'Primary Corridor'}</b><br/>
            Forecast Horizon: <b>+${plume.horizonHours} Hours</b><br/>
            ${plume.avgPm25 ? `Expected PM2.5 Impact: <b>${plume.avgPm25.toFixed(1)} µg/m³</b>` : ''}
          </p>
        </div>`
      );

      polygon.addTo(plumesLayer);
    });
  }, [plumes, showPlumes]);

  // Update Hotspots Layer
  useEffect(() => {
    if (!layersRef.current) return;
    const { hotspotsLayer } = layersRef.current;
    hotspotsLayer.clearLayers();

    if (!showHotspots || hotspots.length === 0) return;

    hotspots.forEach((spot) => {
      const frp = spot.frp ?? 10;
      const radius = Math.min(Math.max(frp / 10, 4), 14);

      const marker = L.circleMarker([spot.lat, spot.lon], {
        radius,
        fillColor: '#FF5376',
        color: '#18181B',
        weight: 1.5,
        fillOpacity: 0.85,
      });

      marker.bindPopup(
        `<div style="font-family: Plus Jakarta Sans, sans-serif;">
          <strong style="color: #EA580C;">🔥 Active Biomass Ignition</strong><br/>
          <small>Coords: ${spot.lat.toFixed(3)}, ${spot.lon.toFixed(3)}</small><br/>
          <span>FRP: <b>${frp.toFixed(1)} MW</b></span><br/>
          <span>Confidence: <b>${spot.confidence || 'nominal'}</b></span>
        </div>`
      );

      marker.addTo(hotspotsLayer);
    });
  }, [hotspots, showHotspots]);

  // Update Stations Layer
  useEffect(() => {
    if (!layersRef.current) return;
    const { stationsLayer } = layersRef.current;
    stationsLayer.clearLayers();

    if (!showStations || stations.length === 0) return;

    stations.forEach((st) => {
      const aqi = st.aqi ?? (st.pm25 ? Math.round(st.pm25 * 1.6) : 0);
      const { color, category } = getAqiCategoryAndColor(aqi);
      const isSelected = selectedStationId === st.id;

      const markerHtml = `
        <div style="
          background-color: ${color};
          border: 2px solid #18181B;
          width: ${isSelected ? '32px' : '26px'};
          height: ${isSelected ? '32px' : '26px'};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 10px;
          color: #18181B;
          box-shadow: 2px 2px 0px #18181B;
          cursor: pointer;
        ">
          ${aqi}
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'prana-station-marker',
        iconSize: [isSelected ? 32 : 26, isSelected ? 32 : 26],
        iconAnchor: [isSelected ? 16 : 13, isSelected ? 16 : 13],
      });

      const marker = L.marker([st.lat, st.lon], { icon: customIcon });

      marker.bindPopup(
        `<div style="font-family: Plus Jakarta Sans, sans-serif; min-width: 160px;">
          <h4 style="margin: 0 0 4px; font-size: 13px; font-weight: 700; color: #18181B;">${st.name}</h4>
          <span style="display:inline-block; padding: 2px 6px; background: ${color}; border: 1px solid #18181B; border-radius: 4px; font-size: 11px; font-weight: 700;">
            AQI ${aqi} • ${category}
          </span>
          <div style="margin-top: 6px; font-size: 12px; color: #52525B;">
            PM2.5: <b>${st.pm25 != null ? `${st.pm25.toFixed(1)} µg/m³` : 'N/A'}</b><br/>
            Source: <small>${st.source || 'CPCB CAAQMS'}</small>
          </div>
        </div>`
      );

      marker.on('click', () => {
        onSelectStation?.(st.id);
      });

      marker.addTo(stationsLayer);
    });
  }, [stations, showStations, selectedStationId, onSelectStation]);

  return (
    <div
      ref={mapContainerRef}
      style={{ height }}
      className={`w-full rounded-xl border-2 border-ink-black overflow-hidden shadow-[4px_4px_0px_#18181B] z-0 ${className}`}
    />
  );
};

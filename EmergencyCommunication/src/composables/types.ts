import type { Viewer, Cartographic, Cartesian3, TerrainProvider } from 'cesium';

export interface GeoPosition {
  lat: number;
  lon: number;
  hae: number;
  timestamp?: number;
}

export interface TAKClientConfig {
  server: string;
  uid?: string;
  callsign: string;
  group: 'Red' | 'Blue' | 'Green' | 'Yellow';
  updateInterval?: number;
  reconnectPolicy?: ReconnectPolicy;
}

export interface ReconnectPolicy {
  maxRetries: number;
  baseDelay: number;
  backoffFactor: number;
}

export interface TAKClientState {
  ws: WebSocket | null;
  retryCount: number;
  lastPosition: GeoPosition | null;
  positionHistory: GeoPosition[];
  status: {
    battery: number;
    connection: 'connected' | 'disconnected' | 'connecting' | 'error';
  };
}
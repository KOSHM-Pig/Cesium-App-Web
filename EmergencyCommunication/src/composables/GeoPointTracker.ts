import * as Cesium from 'cesium';
import type { GeoPosition } from './types'; 

export class GeoPointTracker {
  private viewer: Cesium.Viewer;
  private terrainCache: Map<string, number>;
  private currentPosition: Cesium.Cartographic;

  constructor(viewer: Cesium.Viewer) {
    if (!viewer || !(viewer instanceof Cesium.Viewer)) {
      throw new Error('Invalid Cesium Viewer instance');
    }

    this.viewer = viewer;
    this.terrainCache = new Map();
    this.currentPosition = new Cesium.Cartographic();
  }

  async getCurrentPoint(): Promise<GeoPosition | null> {
    try {
      const cameraPosition = this.viewer.camera.positionCartographic.clone();
      const terrainHeight = await this.sampleTerrainHeight(cameraPosition);
      
      return {
        lat: Cesium.Math.toDegrees(cameraPosition.latitude),
        lon: Cesium.Math.toDegrees(cameraPosition.longitude),
        hae: terrainHeight,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Failed to get position:', error);
      return null;
    }
  }

  private async sampleTerrainHeight(position: Cesium.Cartographic): Promise<number> {
    const precision = 1e5;
    const cacheKey = `${Math.round(position.longitude * precision)}_${Math.round(position.latitude * precision)}`;

    if (this.terrainCache.has(cacheKey)) {
      return this.terrainCache.get(cacheKey)!;
    }

    const terrainSample = await Cesium.sampleTerrainMostDetailed(
      this.viewer.terrainProvider,
      [Cesium.Cartographic.fromRadians(position.longitude, position.latitude)]
    );

    const height = terrainSample[0].height;
    this.terrainCache.set(cacheKey, height);
    return height;
  }
}

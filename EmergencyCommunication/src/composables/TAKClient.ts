import { GeoPointTracker, GeoPosition } from './GeoPointTracker';
import * as Cesium from 'cesium';
import type { TAKClientConfig, TAKClientState } from './types';

export class TAKClient {
  private config: TAKClientConfig;
  private geoTracker: GeoPointTracker;
  private state: TAKClientState;
  private updateLoop?: NodeJS.Timeout;

  constructor(viewer: Cesium.Viewer, config: TAKClientConfig) {
    this.config = {
      uid: this.generateSerialId(),
      updateInterval: 3000,
      reconnectPolicy: {
        maxRetries: 5,
        baseDelay: 1000,
        backoffFactor: 2
      },
      ...config
    };

    this.geoTracker = new GeoPointTracker(viewer);
    this.state = {
      ws: null,
      retryCount: 0,
      lastPosition: null,
      positionHistory: [],
      status: {
        battery: 100,
        connection: 'disconnected'
      }
    };
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state.ws) {
        return reject(new Error('Already connected'));
      }

      this.state.ws = new WebSocket(this.config.server);
      this.state.status.connection = 'connecting';

      this.setupWebSocketHandlers(resolve, reject);
      this.startUpdateLoop();
    });
  }

  disconnect(): void {
    if (this.state.ws) {
      this.state.ws.close();
      this.state.ws = null;
    }
    clearInterval(this.updateLoop);
    this.state.status.connection = 'disconnected';
  }

  private generateSerialId(): string {
    const timePart = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substr(2, 4);
    return `${timePart}-${randomPart}`.toUpperCase();
  }

  private setupWebSocketHandlers(resolve: () => void, reject: (reason: Error) => void): void {
    if (!this.state.ws) return;

    this.state.ws.onopen = () => {
      this.state.retryCount = 0;
      this.state.status.connection = 'connected';
      resolve();
    };

    this.state.ws.onerror = (event: Event) => {
      this.handleConnectionError(new Error('WebSocket error occurred'));
      reject(new Error('Connection failed'));
    };

    this.state.ws.onclose = () => {
      this.handleReconnect();
      this.state.status.connection = 'disconnected';
    };
  }

  private async sendPositionUpdate(): Promise<void> {
    const position = await this.geoTracker.getCurrentPoint();
    if (!position || this.isDuplicatePosition(position)) return;

    try {
      const cotMessage = this.buildCoTMessage(position);
      this.state.ws?.send(cotMessage);
      this.updatePositionHistory(position);
    } catch (error) {
      this.handleUpdateError(error as Error);
    }
  }

  private buildCoTMessage(position: GeoPosition): string {
    return `
<event version="2.0" 
       uid="${this.config.uid}" 
       type="a-h-G-U-C"
       time="${this.getTAKTimestamp()}"
       how="m-g">
  <point lat="${position.lat.toFixed(7)}"
         lon="${position.lon.toFixed(7)}"
         hae="${position.hae.toFixed(1)}"
         ce="5.0" 
         le="7.0"/>
  <detail>
    <contact callsign="${this.config.callsign}"/>
    <__group name="${this.config.group}" role="HQ"/>
    <status battery="${this.state.status.battery}"/>
    <takv platform="WebTAK" version="2.0"/>
    <track course="${this.calculateBearing().toFixed(1)}"
           speed="${this.calculateSpeed().toFixed(1)}"/>
  </detail>
</event>`;
  }

  private getTAKTimestamp(): string {
    return new Date().toISOString().replace('Z', '+00:00');
  }

  private isDuplicatePosition(newPos: GeoPosition): boolean {
    return !!this.state.lastPosition && 
      Math.abs(newPos.lat - this.state.lastPosition.lat) < 1e-6 &&
      Math.abs(newPos.lon - this.state.lastPosition.lon) < 1e-6;
  }

  private updatePositionHistory(pos: GeoPosition): void {
    this.state.lastPosition = { ...pos };
    this.state.positionHistory.push(pos);
    if (this.state.positionHistory.length > 100) {
      this.state.positionHistory.shift();
    }
  }

  private calculateBearing(): number {
    if (this.state.positionHistory.length < 2) return 0;
    
    const [prev, current] = this.state.positionHistory.slice(-2);
    const dLon = (current.lon - prev.lon) * Math.PI / 180;
    
    const y = Math.sin(dLon) * Math.cos(current.lat * Math.PI / 180);
    const x = Math.cos(prev.lat * Math.PI / 180) * Math.sin(current.lat * Math.PI / 180) -
              Math.sin(prev.lat * Math.PI / 180) * Math.cos(current.lat * Math.PI / 180) * Math.cos(dLon);
    
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  private calculateSpeed(): number {
    if (this.state.positionHistory.length < 2) return 0;
    
    const [prev, current] = this.state.positionHistory.slice(-2);
    const distance = Cesium.Cartesian3.distance(
      Cesium.Cartesian3.fromDegrees(prev.lon, prev.lat, prev.hae),
      Cesium.Cartesian3.fromDegrees(current.lon, current.lat, current.hae)
    );
    const timeDiff = (current.timestamp! - prev.timestamp!) / 1000;
    return timeDiff > 0 ? distance / timeDiff : 0;
  }

  private startUpdateLoop(): void {
    this.updateLoop = setInterval(async () => {
      await this.sendPositionUpdate();
    }, this.config.updateInterval);
  }

  private handleReconnect(): void {
    if (this.state.retryCount >= this.config.reconnectPolicy.maxRetries) {
      console.error('Maximum reconnection attempts reached');
      return;
    }

    const delay = this.config.reconnectPolicy.baseDelay * 
                 Math.pow(this.config.reconnectPolicy.backoffFactor, this.state.retryCount);
    
    setTimeout(() => {
      this.state.retryCount++;
      this.connect().catch(console.error);
    }, delay);
  }

  private handleConnectionError(error: Error): void {
    console.error('Connection error:', error);
    this.state.status.connection = 'error';
    this.disconnect();
  }

  private handleUpdateError(error: Error): void {
    console.error('Update failed:', error);
    this.state.status.battery = Math.max(0, this.state.status.battery - 5);
    
    if (this.state.status.battery <= 20) {
      console.warn('Low battery warning!');
    }
  }
}
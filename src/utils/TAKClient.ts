import { GeoPointTracker } from './GeoPointTracker';
import { GeoPosition } from './types';
import * as Cesium from 'cesium';
import type { TAKClientConfig, TAKClientState } from './types';

/*​
 * TAK 协议客户端核心类
 * 功能：连接 TAK 服务器，持续发送 CoT（Cursor on Target）格式的位置情报
 */

export class TAKClient {
  private config: TAKClientConfig;// 客户端配置（必须包含重连策略）
  private geoTracker: GeoPointTracker;// 地理坐标追踪器
  private state: TAKClientState;// 运行时状态管理
  private updateLoop?: NodeJS.Timeout;// 位置上报定时器

  constructor(viewer: Cesium.Viewer, config: TAKClientConfig) {
    this.config = config; // 直接使用用户配置
  // 必须验证关键参数
    if (!config.reconnectPolicy) {
      throw new Error('reconnectPolicy is required');
    }

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
  /*​
  * 生成设备唯一标识符
  * @returns 格式：时间戳基数36编码-4位随机码（示例：K5H3-8G7D）
  */
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
  /*​
  * 发送位置更新（核心业务逻辑）
  * 流程：
  * 1. 获取当前坐标
  * 2. 过滤重复坐标（经纬度差异 < 1e-6 度≈0.11米）
  * 3. 生成 CoT 消息
  * 4. 通过 WebSocket 发送
  * 5. 更新位置历史
  */
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
  /*​
  * 检测重复位置（防抖动过滤）
  * @param newPos 新坐标
  * @returns 当经纬度差异小于 1e-6 度时视为重复
  */
  private isDuplicatePosition(newPos: GeoPosition): boolean {
    return !!this.state.lastPosition && 
      Math.abs(newPos.lat - this.state.lastPosition.lat) < 1e-6 &&
      Math.abs(newPos.lon - this.state.lastPosition.lon) < 1e-6;
  }
  /*​
  * 更新位置历史记录（FIFO队列）
  * @param pos 新位置
  * 功能：
  * - 保存最新位置
  * - 维护最多100条历史记录
  */
  private updatePositionHistory(pos: GeoPosition): void {
    this.state.lastPosition = { ...pos };
    this.state.positionHistory.push(pos);
    if (this.state.positionHistory.length > 100) {
      this.state.positionHistory.shift();
    }
  }
  /*​
  * 计算航向角（真北方向）
  * @returns 角度值（0-359度）
  * 算法：
  * - 使用最近两个位置点
  * - 基于球面三角公式计算方位角
  */
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
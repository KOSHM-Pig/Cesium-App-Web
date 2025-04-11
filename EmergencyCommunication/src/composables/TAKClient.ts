import { GeoPointTracker } from './GeoPointTracker.js';

class TAKClient {
  constructor(viewer, config = {}) {
    this.config = {
      server: 'wss://tak.example.com:8087',
      uid: `NWPU-${this.generateSerialId()}`,
      callsign: '应急指挥车001',
      group: 'Blue',
      updateInterval: 3000, // 3秒更新间隔
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
      status: {
        battery: 100,
        connection: 'disconnected'
      }
    };
  }

  // 生成设备唯一ID
  generateSerialId() {
    const timePart = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substr(2, 4);
    return `${timePart}-${randomPart}`.toUpperCase();
  }

  // 连接TAK服务器
  async connect() {
    try {
      this.state.ws = new WebSocket(this.config.server);
      await this._setupWebSocketHandlers();
      this.state.status.connection = 'connecting';
      
      // 启动数据上报循环
      this.updateLoop = setInterval(() => this.sendPositionUpdate(), this.config.updateInterval);
      
      return new Promise((resolve, reject) => {
        this.state.ws.onopen = () => {
          this.state.status.connection = 'connected';
          resolve();
        };
        this.state.ws.onerror = reject;
      });
    } catch (error) {
      this._handleConnectionError(error);
      throw error;
    }
  }

  // 发送位置更新
  async sendPositionUpdate() {
    try {
      const position = await this.geoTracker.getCurrentPoint();
      if (!position || this._isDuplicatePosition(position)) return;

      const cotMessage = this._buildCoTMessage(position);
      this.state.ws.send(cotMessage);
      this._updatePositionHistory(position);
      
      console.log('位置更新成功:', {
        lat: position.lat.toFixed(6),
        lon: position.lon.toFixed(6),
        hae: position.hae.toFixed(1)
      });
    } catch (error) {
      console.error('位置更新失败:', error);
      this._handleUpdateError(error);
    }
  }

  // 构建CoT消息
  _buildCoTMessage({ lat, lon, hae }) {
    return `
<event version="2.0" 
       uid="${this.config.uid}" 
       type="a-h-G-U-C"
       time="${this._getTAKTimestamp()}"
       how="m-g">
  <point lat="${lat.toFixed(7)}"
         lon="${lon.toFixed(7)}"
         hae="${hae.toFixed(1)}"
         ce="5.0" 
         le="7.0"/>
  <detail>
    <contact callsign="${this.config.callsign}"/>
    <__group name="${this.config.group}" role="HQ"/>
    <status battery="${this.state.status.battery}"/>
    <takv platform="WebTAK" version="2.0"/>
    <track course="${this._calculateBearing().toFixed(1)}"
           speed="${this._calculateSpeed().toFixed(1)}"/>
  </detail>
</event>`;
  }

  // 辅助方法
  _getTAKTimestamp() {
    return new Date().toISOString().replace('Z','+00:00');
  }

  _isDuplicatePosition(newPos) {
    return this.state.lastPosition && 
      Math.abs(newPos.lat - this.state.lastPosition.lat) < 1e-6 &&
      Math.abs(newPos.lon - this.state.lastPosition.lon) < 1e-6;
  }

  _updatePositionHistory(pos) {
    this.state.lastPosition = { ...pos };
    this.state.positionHistory = this.state.positionHistory || [];
    this.state.positionHistory.push(pos);
    if (this.state.positionHistory.length > 100) {
      this.state.positionHistory.shift();
    }
  }

  _calculateBearing() {
    const history = this.state.positionHistory;
    if (history.length < 2) return 0;
    
    const p1 = history[history.length-2];
    const p2 = history[history.length-1];
    const dLon = (p2.lon - p1.lon) * Math.PI/180;
    const y = Math.sin(dLon) * Math.cos(p2.lat*Math.PI/180);
    const x = Math.cos(p1.lat*Math.PI/180)*Math.sin(p2.lat*Math.PI/180) -
              Math.sin(p1.lat*Math.PI/180)*Math.cos(p2.lat*Math.PI/180)*Math.cos(dLon);
    return (Math.atan2(y, x) * 180/Math.PI + 360) % 360;
  }

  _calculateSpeed() {
    const history = this.state.positionHistory;
    if (history.length < 2) return 0;
    
    const p1 = history[history.length-2];
    const p2 = history[history.length-1];
    const distance = Cesium.Cartesian3.distance(
      Cesium.Cartesian3.fromDegrees(p1.lon, p1.lat, p1.hae),
      Cesium.Cartesian3.fromDegrees(p2.lon, p2.lat, p2.hae)
    );
    const timeDiff = (p2.timestamp - p1.timestamp) / 1000;
    return timeDiff > 0 ? distance / timeDiff : 0;
  }

  // 错误处理
  _setupWebSocketHandlers() {
    this.state.ws.onclose = () => {
      this.state.status.connection = 'disconnected';
      if (this.state.retryCount < this.config.reconnectPolicy.maxRetries) {
        const delay = this.config.reconnectPolicy.baseDelay * 
                      Math.pow(this.config.reconnectPolicy.backoffFactor, this.state.retryCount);
        setTimeout(() => this.connect(), delay);
        this.state.retryCount++;
      }
    };

    this.state.ws.onerror = (error) => {
      console.error('WebSocket错误:', error);
      this.state.ws.close();
    };
  }

  _handleConnectionError(error) {
    console.error('连接失败:', error);
    this.state.status.connection = 'error';
  }

  _handleUpdateError(error) {
    this.state.status.battery = Math.max(0, this.state.status.battery - 5);
    if (this.state.status.battery <= 20) {
      console.warn('低电量警告!');
    }
  }
}

// --------------------------
// 使用示例
// --------------------------
const initTAKSystem = async (viewer) => {
  try {
    const takClient = new TAKClient(viewer, {
      callsign: '前线指挥车001',
      group: 'Red',
      server: 'wss://tak.example.com:8087'
    });
    
    await takClient.connect();
    console.log('TAK系统初始化完成');
    return takClient;
  } catch (error) {
    console.error('系统初始化失败:', error);
    return null;
  }
};

// 在Cesium初始化后调用
const viewer = new Cesium.Viewer('cesiumContainer');
initTAKSystem(viewer);
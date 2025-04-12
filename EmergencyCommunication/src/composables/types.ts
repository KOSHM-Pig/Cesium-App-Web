import type { Viewer, Cartographic, Cartesian3, TerrainProvider } from 'cesium';

/* /​**​
 * 地理位置数据接口
 * @property lat - 纬度（单位：度）
 * @property lon - 经度（单位：度）
 * @property hae - 海拔高度（单位：米，椭球高度）
 * @property timestamp - 可选时间戳（单位：毫秒）
 */
export interface GeoPosition {
  lat: number;
  lon: number;
  hae: number;
  timestamp?: number;
}

​/* 
 * TAK 客户端核心配置接口
 * @property server - 必填，TAK 服务器 WebSocket 地址（如 ws://localhost:8080）
 * @property uid - 可选唯一设备标识，未提供时自动生成
 * @property callsign - 必填，用户呼号（战场标识）
 * @property group - 必填，所属阵营（用于地图图标颜色分类）
 * @property updateInterval - 可选位置上报间隔（默认 3000 毫秒）
 * @property reconnectPolicy - 必填网络重连策略（最大重试次数、延迟参数）
 * @property [otherProps] - 允许扩展其他配置属性 */
export interface TAKClientConfig {
  server: string;
  uid?: string;
  callsign: string;
  group: 'Red' | 'Blue' | 'Green' | 'Yellow';
  updateInterval?: number;
  reconnectPolicy: ReconnectPolicy;
  [otherProps: string]: any;
}

/* /​**​
 * 网络重连策略配置
 * @property maxRetries - 最大重试次数（达到后停止重连）
 * @property baseDelay - 基础等待时间（单位：毫秒，用于指数退避计算）
 * @property backoffFactor - 退避因子（每次重试延迟倍数，如 2 表示延迟翻倍）
 */
 export interface ReconnectPolicy {
  maxRetries: number;
  baseDelay: number;
  backoffFactor: number;
}

/* /​**​
 * TAK 客户端运行时状态
 * @property ws - WebSocket 连接实例（null 表示未连接）
 * @property retryCount - 当前重连尝试次数
 * @property lastPosition - 上次成功上报的地理位置
 * @property positionHistory - 位置历史记录（最多保留 100 条）
 * @property status - 设备状态
 *   @property battery - 剩余电量（模拟值，每次上报失败减 5%）
 *   @property connection - 连接状态（connected/disconnected/connecting/error）
 */
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

​/* 
 * 地理坐标追踪器 - 用于获取相机位置和地形高程数据
 * 功能：实时追踪3D视图中的相机地理位置，计算地形高度并缓存结果
 */
import * as Cesium from 'cesium';
import type { GeoPosition } from './types'; 

export class GeoPointTracker {
  /* ​
   * 地形高度缓存（LRU缓存策略）
   * Key格式：经度_纬度（精度1e-5度，约1米级缓存）
   * Value：地形高程值（米）
    */
  private viewer: Cesium.Viewer;
  private terrainCache: Map<string, number>;
  private currentPosition: Cesium.Cartographic;

​/* 
   * 构造函数 - 初始化核心组件
   * @param viewer Cesium Viewer实例（必须通过验证）
   * @throws 当传入无效的Viewer时抛出错误
 */
  constructor(viewer: Cesium.Viewer) {
    // 防御性验证（确保操作对象有效）
    if (!viewer || !(viewer instanceof Cesium.Viewer)) {
      throw new Error('Invalid Cesium Viewer instance');
    }

    this.viewer = viewer;
    this.terrainCache = new Map();
    this.currentPosition = new Cesium.Cartographic();
  }
 ​/* 
  * 获取当前相机地理位置（异步）
  * @returns 包含经纬度高程的GeoPosition对象，失败时返回null
  * 实现流程：
  * 1. 克隆相机当前位置（避免污染原始数据）
  * 2. 获取地形高度（含缓存机制）
  * 3. 转换弧度坐标为角度格式
   */
  async getCurrentPoint(): Promise<GeoPosition | null> {
    try {
      const cameraPosition = this.viewer.camera.positionCartographic.clone();
      const terrainHeight = await this.sampleTerrainHeight(cameraPosition);
      // 返回标准化地理数据
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
​/* 
* 地形高度采样（私有方法）
* @param position 需要采样的地理坐标（弧度制）
* @returns 地形高程值（米）
* 实现策略：
* 1. 基于经纬度生成唯一缓存键（1e5精度≈1.11米）
* 2. 优先返回缓存数据
* 3. 无缓存时通过Cesium API获取并存储
*/ 
  private async sampleTerrainHeight(position: Cesium.Cartographic): Promise<number> {
    const precision = 1e7;// 控制缓存精度（可调整）
    // 生成缓存键（例：-118.12345_34.56789）
    const cacheKey = `${Math.round(position.longitude * precision)}_${Math.round(position.latitude * precision)}`;

    if (this.terrainCache.has(cacheKey)) {
      return this.terrainCache.get(cacheKey)!;// 非空断言（已通过has检查）
    }
    // 调用Cesium地形采样API（最详细层级）
    const terrainSample = await Cesium.sampleTerrainMostDetailed(
      this.viewer.terrainProvider,
      [Cesium.Cartographic.fromRadians(position.longitude, position.latitude)]
    );
    // 提取并缓存高度数据
    const height = terrainSample[0].height;
    this.terrainCache.set(cacheKey, height);
    return height;
  }
}
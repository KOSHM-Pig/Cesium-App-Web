import * as Cesium from 'cesium';
import { useCesium } from './cesiumUtils';

type CotStyleConfig = {
  [cotType: string]: {
    entityType: 'point' | 'ellipsoid' | 'prism';
    color: string | Cesium.Color;
    size?: number;
    labelTemplate?: string;
  };
};

export class TAKReceiver {
  private utils: ReturnType<typeof useCesium>;
  private styleConfig: CotStyleConfig;
  private entityMap: Map<string, Cesium.Entity> = new Map();

  constructor(cesiumUtils: ReturnType<typeof useCesium>, customStyles?: CotStyleConfig) {
    this.utils = cesiumUtils;
    this.styleConfig = this.initializeStyleConfig(customStyles);
  }

  public processCotMessage(xmlString: string): void {
    try {
      const cotData = this.parseCotXml(xmlString);
      const [lon, lat, height] = this.convertPosition(cotData.position);
      const style = this.getEntityStyle(cotData.type);
      
      this.updateOrCreateEntity(
        cotData.uid,
        style,
        { lon, lat, height },
        cotData.metadata
      );
    } catch (error) {
      console.error('CoT消息处理失败:', error);
    }
  }

  private parseCotXml(xmlString: string): {
    uid: string;
    type: string;
    position: Cesium.Cartesian3;
    metadata: any;
  } {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    // 解析基础属性
    const event = doc.querySelector('event');
    if (!event) throw new Error('无效的CoT格式');
    const uid = event.getAttribute('uid') || '';
    const type = event.getAttribute('type') || 'unknown';

    // 解析坐标
    const point = doc.querySelector('point');
    if (!point) throw new Error('缺少坐标信息');
    const lat = parseFloat(point.getAttribute('lat') || '');
    const lon = parseFloat(point.getAttribute('lon') || '');
    const hae = parseFloat(point.getAttribute('hae') || '0');
    if (isNaN(lat) || isNaN(lon)) throw new Error('无效的坐标值');

    // 解析元数据
    const metadata = {
      callsign: doc.querySelector('contact')?.getAttribute('callsign'),
      group: doc.querySelector('__group')?.getAttribute('name'),
      battery: parseFloat(doc.querySelector('status')?.getAttribute('battery') || '0'),
      course: parseFloat(doc.querySelector('track')?.getAttribute('course') || '0'),
      speed: parseFloat(doc.querySelector('track')?.getAttribute('speed') || '0')
    };

    return {
      uid,
      type,
      position: Cesium.Cartesian3.fromDegrees(lon, lat, hae),
      metadata
    };
  }

  private convertPosition(position: Cesium.Cartesian3): [number, number, number] {
    const carto = Cesium.Cartographic.fromCartesian(position);
    return [
      Cesium.Math.toDegrees(carto.longitude),
      Cesium.Math.toDegrees(carto.latitude),
      carto.height
    ];
  }

  private getEntityStyle(cotType: string) {
    return this.styleConfig[cotType] || this.styleConfig['default'];
  }

  private updateOrCreateEntity(
    uid: string,
    style: CotStyleConfig[string],
    pos: { lon: number; lat: number; height: number },
    metadata: any
  ) {
    const existing = this.entityMap.get(uid);
    const color = this.normalizeColor(style.color);
    const label = this.generateLabel(style.labelTemplate, metadata);

    if (existing) {
      this.updateExistingEntity(existing, pos, color, label);
    } else {
      this.createNewEntity(uid, style, pos, color, label, metadata);
    }
  }

  private normalizeColor(color: string | Cesium.Color): Cesium.Color {
    if (color instanceof Cesium.Color) return color;
    try {
      return Cesium.Color.fromCssColorString(color) || Cesium.Color.YELLOW;
    } catch {
      return Cesium.Color.YELLOW;
    }
  }

  private generateLabel(template?: string, metadata?: any): string {
    if (!template) return metadata.callsign || '未知目标';
    return template.replace(/\${([^}]+)}/g, (_, key) => metadata[key]?.toString() || '');
  }

  private updateExistingEntity(
    entity: Cesium.Entity,
    pos: { lon: number; lat: number; height: number },
    color: Cesium.Color,
    label: string
  ) {
    // 更新位置
    if (entity.position) {
      const newPos = Cesium.Cartesian3.fromDegrees(pos.lon, pos.lat, pos.height);
      entity.position = new Cesium.ConstantPositionProperty(newPos);
    }

    // 更新样式
    this.utils.changeEntityColor(entity, color);
    this.utils.changeEntityLabel(entity, label);
  }

  private createNewEntity(
    uid: string,
    style: CotStyleConfig[string],
    pos: { lon: number; lat: number; height: number },
    color: Cesium.Color,
    label: string,
    metadata: any
  ) {
    let entity: Cesium.Entity | null = null;

    switch (style.entityType) {
      case 'point':
        entity = this.utils.addPointByLatLon(pos.lat, pos.lon, pos.height, color);
        break;

      case 'ellipsoid':
        entity = this.utils.addEllipsoidCylinderByLatLon(
          pos.lat,
          pos.lon,
          pos.height,
          style.size || 10,
          style.size || 5,
          color
        );
        break;

      case 'prism':
        entity = this.utils.addRegularPrism(
          pos.lat,
          pos.lon,
          pos.height,
          style.size || 20,
          6,
          color
        );
        break;
    }

    if (entity) {
      this.utils.changeEntityLabel(entity, label);
      this.entityMap.set(uid, entity);
    }
  }

  private initializeStyleConfig(custom?: CotStyleConfig): CotStyleConfig {
    const defaults = {
      default: {
        entityType: 'point',
        color: Cesium.Color.YELLOW,
        labelTemplate: '${callsign}'
      },
      'a-h-G-U-C': {
        entityType: 'point',
        color: '#32CD32',
        labelTemplate: '人员:${callsign}'
      },
      'a-f-G-U-C': {
        entityType: 'ellipsoid',
        color: '#1E90FF',
        size: 15,
        labelTemplate: '无人机:${speed}km/h'
      },
      'a-v-G-U-C': {
        entityType: 'prism',
        color: 'ORANGE',
        size: 8,
        labelTemplate: '车辆:${group}'
      }
    };
    return { ...defaults, ...custom };
  }

  public removeEntity(uid: string): void {
    const entity = this.entityMap.get(uid);
    if (entity) {
      this.utils.deleteEntity(entity);
      this.entityMap.delete(uid);
    }
  }

  public clearAll(): void {
    this.entityMap.forEach(entity => this.utils.deleteEntity(entity));
    this.entityMap.clear();
  }
}

// 使用示例
/*
const cesiumUtils = useCesium();
const receiver = new TAKReceiver(cesiumUtils, {
  'custom-type': {
    entityType: 'prism',
    color: '#FF4500',
    size: 10,
    labelTemplate: '自定义:${speed}'
  }
});

// 处理WebSocket消息
ws.onmessage = (event) => {
  receiver.processCotMessage(event.data);
};

// 清理所有实体
receiver.clearAll();
*/
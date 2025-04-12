import * as Cesium from 'cesium';
import { ref } from 'vue';
import { mapProviders } from './mapProviders';
import NotificationBox from '../components/NotificationBox.vue';
import { showNotification } from '../utils/notification';

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI1MWU0NGIwMS1hZWQyLTRlODktYmExMi04NzJjOGYyMTE5Y2EiLCJpZCI6MjkxMjMzLCJpYXQiOjE3NDQzNjQ4ODF9.huZ7JqhHqnuhQWzjP6qxJIS6LCUPpbArJqZd1JzTfUA'; // 替换实际token

Cesium.Ion.defaultAccessToken = token; // 设置Cesium Ion的访问令牌

// 用于记录点、线、面的数量
const pointCounter = ref(0);
const lineCounter = ref(0);
const polygonCounter = ref(0);

export const useCesium = () => {
  const cesiumContainer = ref<HTMLDivElement | null>(null);
  let viewer: Cesium.Viewer;
  let currentImageryProvider: Cesium.ImageryProvider | undefined;
  const selectedMap = ref<'arcgis' | 'tencent' | 'local'>('arcgis');
  const longitude = ref<string | null>(null);
  const latitude = ref<string | null>(null);
  const height = ref<string | null>(null);
  const longitude_num = ref<number | null>(null);
  const latitude_num = ref<number | null>(null);
  const height_num = ref<number | null>(null);

  // 新增 lineEntities 定义
  const lineEntities = ref<Cesium.Entity[]>([]);
  // 存储所有已完成的线实体
  const completedLineEntities = ref<Cesium.Entity[]>([]);
  // 存储当前正在绘制的线实体
  let currentLineEntity: Cesium.Entity | null = null;
  // 存储当前标面过程中的点
  const currentPolygonPoints = ref<Array<{ lat: number; lon: number; height: number }>>([]);
  // 存储当前绘制的面实体
  let currentPolygonEntity: Cesium.Entity | null = null;
  // 存储所有完成的面实体
  const completedPolygonEntities = ref<Cesium.Entity[]>([]);

  // 初始化Cesium Viewer
  const initializeCesium = () => {
    if (!cesiumContainer.value) return;

    viewer = new Cesium.Viewer(cesiumContainer.value, {
      shouldAnimate: true,
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      navigationHelpButton: false,
      navigationInstructionsInitiallyVisible: false,
      creditContainer: document.createElement("div"),
      terrainProvider: Cesium.createWorldTerrain({

      })
    });

    // 隐藏版权信息
    const creditContainer = viewer.cesiumWidget.creditContainer as HTMLElement;
    creditContainer.style.display = 'none';
    resetMap();
    // 初始化默认地图
    loadMap('arcgis');

    viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    isViewerInitialized.value = true;
    // 设置初始视角
    // viewer.camera.flyTo({
    //   destination: Cesium.Cartesian3.fromDegrees(116.4074, 39.9095, 100000),
    //   orientation: {
    //     heading: Cesium.Math.toRadians(0),
    //     pitch: Cesium.Math.toRadians(-90)
    //   }
    // });

    // 地理信息显示 跟随鼠标移动事件

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      const cartesian = viewer.scene.globe.pick(viewer.camera.getPickRay(movement.endPosition), viewer.scene);
      if (cartesian) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const long = Cesium.Math.toDegrees(cartographic.longitude);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);
        const alt = viewer.camera.positionCartographic.height;
        longitude_num.value = long;
        latitude_num.value = lat;
        height_num.value = Math.round(alt);

        // 添加东经西经、北纬南纬标识
        longitude.value = `${Math.abs(long).toFixed(7)}° ${long >= 0 ? 'E' : 'W'}`;
        latitude.value = `${Math.abs(lat).toFixed(7)}° ${lat >= 0 ? 'N' : 'S'}`;

        // 根据高度切换单位
        if (alt >= 10000) {
          height.value = `${(alt / 1000).toFixed(2)} km`;
        } else {
          height.value = `${alt.toFixed(2)} m`;
        }
      }

    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  };

  // 加载指定地图
  const loadMap = (mapId: keyof typeof mapProviders) => {
    if (!viewer) return;

    // 移除旧图层
    if (currentImageryProvider) {
      viewer.imageryLayers.remove(currentImageryProvider);
    }

    // 添加新图层
    const provider = mapProviders[mapId].provider();
    viewer.imageryLayers.addImageryProvider(provider);
    currentImageryProvider = provider;
  };

  // 地图切换处理
  const handleMapChange = () => {
    loadMap(selectedMap.value);
  };

  // 修改原clearImagery方法为resetMap（网页3/网页5核心方案）
  const resetMap = () => {
    if (viewer) {
      viewer.imageryLayers.removeAll();
      loadMap('arcgis');
      console.log('viewer',viewer)

      showNotification(0, '地图初始化完成', 3000);
    }
  };

  // 销毁Cesium Viewer
  const destroyCesium = () => {
    if (viewer) {
      viewer.destroy();
    }
  };

  // 新增存储线标签实体和面标签实体的数组
  const lineLabelEntities = ref<Cesium.Entity[]>([]);
  const polygonLabelEntities = ref<Cesium.Entity[]>([]);
  
// 新增删除实体的方法
const deleteEntity = (entityId: string | Cesium.Entity) => {
  if (!isViewerInitialized.value || !viewer) {
    console.error('viewer 未初始化，无法执行删除操作');
    return;
  }

  let entity: Cesium.Entity | undefined;
  if (typeof entityId === 'string') {
    entity = viewer.entities.getById(entityId);
  } else {
    entity = entityId;
  }

  let entityLabel = '未知实体';
  let mainEntity: Cesium.Entity | undefined = entity;

  // 检查是否是线标签实体
  const lineLabelIndex = lineLabelEntities.value.indexOf(entity as Cesium.Entity);
  if (lineLabelIndex > -1) {
    mainEntity = completedLineEntities.value[lineLabelIndex];
    const lineLabelEntity = lineLabelEntities.value[lineLabelIndex];
    if (lineLabelEntity && lineLabelEntity.label && lineLabelEntity.label.text) {
      const textProperty = lineLabelEntity.label.text;
      if (typeof textProperty.getValue === 'function') {
        entityLabel = textProperty.getValue(Cesium.JulianDate.now());
      }
    }
    // 删除线标签实体
    viewer.entities.remove(lineLabelEntity);
    lineLabelEntities.value.splice(lineLabelIndex, 1);
    // 删除线实体
    if (mainEntity) {
      viewer.entities.remove(mainEntity);
      completedLineEntities.value.splice(lineLabelIndex, 1);
      lineCounter.value--;
    }
    showNotification(0, `已成功删除实体: ${entityLabel}`, 3000);
    return;
  }

  // 检查是否是面标签实体
  const polygonLabelIndex = polygonLabelEntities.value.indexOf(entity as Cesium.Entity);
  if (polygonLabelIndex > -1) {
    mainEntity = completedPolygonEntities.value[polygonLabelIndex];
    const polygonLabelEntity = polygonLabelEntities.value[polygonLabelIndex];
    if (polygonLabelEntity && polygonLabelEntity.label && polygonLabelEntity.label.text) {
      const textProperty = polygonLabelEntity.label.text;
      if (typeof textProperty.getValue === 'function') {
        entityLabel = textProperty.getValue(Cesium.JulianDate.now());
      }
    }
    // 删除面标签实体
    viewer.entities.remove(polygonLabelEntity);
    polygonLabelEntities.value.splice(polygonLabelIndex, 1);
    // 删除面实体
    if (mainEntity) {
      viewer.entities.remove(mainEntity);
      completedPolygonEntities.value.splice(polygonLabelIndex, 1);
      polygonCounter.value--;
    }
    showNotification(0, `已成功删除实体: ${entityLabel}`, 3000);
    return;
  }

  if (mainEntity) {
    // 先尝试获取普通实体的标签
    if (mainEntity.label && mainEntity.label.text) {
      const textProperty = mainEntity.label.text;
      if (typeof textProperty.getValue === 'function') {
        entityLabel = textProperty.getValue(Cesium.JulianDate.now());
      }
    }

    // 处理线实体
    const lineIndex = completedLineEntities.value.indexOf(mainEntity);
    if (lineIndex > -1) {
      const lineLabelEntity = lineLabelEntities.value[lineIndex];
      if (lineLabelEntity && lineLabelEntity.label && lineLabelEntity.label.text) {
        const lineTextProperty = lineLabelEntity.label.text;
        if (typeof lineTextProperty.getValue === 'function') {
          entityLabel = lineTextProperty.getValue(Cesium.JulianDate.now());
        }
      }
      if (lineLabelEntity) {
        viewer.entities.remove(lineLabelEntity);
        lineLabelEntities.value.splice(lineIndex, 1);
      }
      completedLineEntities.value.splice(lineIndex, 1);
      lineCounter.value--;
    }

    // 处理面实体
    const polygonIndex = completedPolygonEntities.value.indexOf(mainEntity);
    if (polygonIndex > -1) {
      const polygonLabelEntity = polygonLabelEntities.value[polygonIndex];
      if (polygonLabelEntity && polygonLabelEntity.label && polygonLabelEntity.label.text) {
        const polygonTextProperty = polygonLabelEntity.label.text;
        if (typeof polygonTextProperty.getValue === 'function') {
          entityLabel = polygonTextProperty.getValue(Cesium.JulianDate.now());
        }
      }
      if (polygonLabelEntity) {
        viewer.entities.remove(polygonLabelEntity);
        polygonLabelEntities.value.splice(polygonIndex, 1);
      }
      completedPolygonEntities.value.splice(polygonIndex, 1);
      polygonCounter.value--;
    }

    // 删除实体
    viewer.entities.remove(mainEntity);
    showNotification(0, `已成功删除实体: ${entityLabel}`, 3000);
  } else {
    showNotification(1, '未找到要删除的实体', 3000);
  }
};

  // 添加标记点
  const addPoint = (position: Cesium.Cartesian3, color: Cesium.Color) => {
    console.log('viewer:' + viewer);
    if (viewer && viewer.entities) {
      pointCounter.value++;
      viewer.entities.add({
        position: position,
        point: {
          pixelSize: 10,
          color: color
        },
        label: {
          text: `点${pointCounter.value}`,
          font: '14px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -10)
        }
      });
    } else {
      console.log('viewer or viewer.entities is undefined');
    }
  };

  // 根据经纬度和高度添加点
  const addPointByLatLon = (lat: number, lon: number, height: number, color: Cesium.Color) => {
    const position = Cesium.Cartesian3.fromDegrees(lon, lat, height);
    // 格式化经纬度
    const formattedLat = formatCoordinate(lat, true);
    const formattedLon = formatCoordinate(lon, false);
    showNotification(0, `成功在${formattedLat},${formattedLon},${Math.round(height)}添加点`, 3000);
    addPoint(position, color);
  };

  // 切换3D/2D视图
  const switchTo2D = () => {
    if (viewer) {
      viewer.scene.morphTo2D(1.0);
    }
  };
  const switchTo3D = () => {
    if (viewer) {
      viewer.scene.morphTo3D(1.0);
    }
  };

  // 获取当前经纬度对应脚下地面的海平面高度
  const getCameraGroundElevation = (lat: number, lon: number) => {
    if (typeof lon!== 'number' || typeof lat!== 'number') {
      console.error('Invalid longitude or latitude values. Expected numbers.');
      return null;
    }
    if (viewer) {
      const cartographic = Cesium.Cartographic.fromDegrees(lon, lat);
      return viewer.scene.globe.getHeight(cartographic);
    }
    return null;
  };

  // 辅助函数：格式化经纬度
  const formatCoordinate = (value: number, isLatitude: boolean) => {
    const absValue = Math.abs(value).toFixed(4);
    if (isLatitude) {
      return `${absValue}° ${value >= 0 ? 'N' : 'S'}`;
    } else {
      return `${absValue}° ${value >= 0 ? 'E' : 'W'}`;
    }
  };

  // 更新高度信息的函数
  const updateHeightInfo = () => {
    const cartesian = viewer.camera.position;
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    const alt = viewer.camera.positionCartographic.height;
    height_num.value = Math.round(alt);

    // 根据高度切换单位
    if (alt >= 10000) {
      height.value = `${(alt / 1000).toFixed(2)} km`;
    } else {
      height.value = `${alt.toFixed(2)} m`;
    }
  };

  // 定义节流时间间隔（毫秒）
  const THROTTLE_INTERVAL = 100;

  // 记录上次调用 CameraZoomIn 和 CameraZoomOut 的时间
  let lastZoomInTime = 0;
  let lastZoomOutTime = 0;

  // 放大相机
  const CameraZoomIn = () => {
    const now = Date.now();
    // 检查是否在节流时间间隔内
    if (now - lastZoomInTime < THROTTLE_INTERVAL) {
      console.log('操作过于频繁，请稍后再试');
      return;
    }
    lastZoomInTime = now;

    // 手动更新高度信息
    updateHeightInfo();

    if (viewer) {
      // 检查当前对地高度，如果小于等于 50 米则不进行放大操作
      if (height_num.value && height_num.value <= 50) {
        console.log('已经达到最小高度，无法继续放大');
        return;
      }

      const currentPosition = viewer.camera.position;
      const direction = viewer.camera.direction;
      let zoomStep = 100; // 最小步长作为默认值

      // 根据对地高度的 50% 调整放大步长
      if (height_num.value) {
        zoomStep = Math.max(100, height_num.value * 0.5);
      }

      const newPosition = Cesium.Cartesian3.add(
        currentPosition,
        Cesium.Cartesian3.multiplyByScalar(direction, -zoomStep, new Cesium.Cartesian3()),
        new Cesium.Cartesian3()
      );

      viewer.camera.flyTo({
        destination: newPosition,
        orientation: {
          heading: viewer.camera.heading,
          pitch: viewer.camera.pitch,
          roll: viewer.camera.roll
        },
        duration: 1 // 飞行动画持续时间（秒）
      });

      console.log('CameraZoomIn called');
      console.log('Current camera position:', currentPosition);
      console.log('New camera position:', newPosition);
    }
  };

  // 缩小相机
  const CameraZoomOut = () => {
    const now = Date.now();
    // 检查是否在节流时间间隔内
    if (now - lastZoomOutTime < THROTTLE_INTERVAL) {
      console.log('操作过于频繁，请稍后再试');
      return;
    }
    lastZoomOutTime = now;

    // 手动更新高度信息
    updateHeightInfo();

    if (viewer) {
      const currentPosition = viewer.camera.position;
      const direction = viewer.camera.direction;
      let zoomStep = 100; // 最小步长作为默认值

      // 根据对地高度的 50% 调整缩小步长
      if (height_num.value) {
        zoomStep = Math.max(100, height_num.value * 0.5);
      }

      const newPosition = Cesium.Cartesian3.add(
        currentPosition,
        Cesium.Cartesian3.multiplyByScalar(direction, zoomStep, new Cesium.Cartesian3()),
        new Cesium.Cartesian3()
      );

      viewer.camera.flyTo({
        destination: newPosition,
        orientation: {
          heading: viewer.camera.heading,
          pitch: viewer.camera.pitch,
          roll: viewer.camera.roll
        },
        duration: 1 // 飞行动画持续时间（秒）
      });

      console.log('CameraZoomOut called');
      console.log('Current camera position:', currentPosition);
      console.log('New camera position:', newPosition);
    }
  };

  // 添加标线的函数
  const addLine = (positions: Cesium.Cartesian3[], color: Cesium.Color) => {
    if (viewer && viewer.entities) {
      // 清除之前的当前线实体
      if (currentLineEntity) {
        viewer.entities.remove(currentLineEntity);
      }
      const lineEntity = viewer.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArrayHeights(positions.flatMap(pos => {
            const cartographic = Cesium.Cartographic.fromCartesian(pos);
            return [
              Cesium.Math.toDegrees(cartographic.longitude),
              Cesium.Math.toDegrees(cartographic.latitude),
              cartographic.height
            ];
          })),
          width: 5,
          material: color
        }
      });
      currentLineEntity = lineEntity;
      return lineEntity;
    }
    return null;
  };

  // 根据经纬度和高度添加标线
  const addLineByLatLon = (points: Array<{ lat: number; lon: number; height: number }>, color: Cesium.Color) => {
    // 提前缓存转换结果
    const positions = points.map(point =>
      Cesium.Cartesian3.fromDegrees(point.lon, point.lat, point.height)
    );
    return addLine(positions, color);
  };

  //添加面
  const addPolygon = (points: Array<{ lat: number; lon: number; height: number }>, color: Cesium.Color) => {
    if (viewer && viewer.entities && points.length >= 3) {
      const positions = points.map(point =>
        Cesium.Cartesian3.fromDegrees(point.lon, point.lat, point.height)
      );
      const polygonEntity = viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(positions),
          material: color.withAlpha(0.5), // 设置透明度
        }
      });
      return polygonEntity;
    }
    return null;
  };

// 修改 completeCurrentLine 方法，保存线标签实体
  const completeCurrentLine = () => {
  if (currentLineEntity) {
    lineCounter.value++;
    const positions = currentLineEntity.polyline?.positions.getValue(Cesium.JulianDate.now());
    if (positions && positions.length > 0) {
      const labelPosition = positions[Math.floor(positions.length / 2)];
      const labelEntity = viewer.entities.add({
        position: labelPosition,
        point: {
          pixelSize: 0, // 透明点
          color: Cesium.Color.TRANSPARENT
        },
        label: {
          text: `线${lineCounter.value}`,
          font: '14px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -10)
        }
      });
      lineLabelEntities.value.push(labelEntity);
    }
    completedLineEntities.value.push(currentLineEntity);
    currentLineEntity = null;
    showNotification(0, '当前线已绘制完成', 3000);
  }
};

// 修改 completeCurrentPolygon 方法，保存面标签实体
const completeCurrentPolygon = () => {
  if (currentPolygonEntity) {
    polygonCounter.value++;
    const positions = currentPolygonEntity.polygon?.hierarchy.getValue(Cesium.JulianDate.now()).positions;
    if (positions && positions.length > 0) {
      const center = Cesium.BoundingSphere.fromPoints(positions).center;
      const labelEntity = viewer.entities.add({
        position: center,
        point: {
          pixelSize: 0, // 透明点
          color: Cesium.Color.TRANSPARENT
        },
        label: {
          text: `面${polygonCounter.value}`,
          font: '14px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -10)
        }
      });
      polygonLabelEntities.value.push(labelEntity);
    }
    completedPolygonEntities.value.push(currentPolygonEntity);
    currentPolygonEntity = null;
    currentPolygonPoints.value = [];
    showNotification(0, '当前面绘制完成', 3000);
  }
};

  // 更新当前面的方法
  const updateCurrentPolygon = (color: Cesium.Color) => {
    if (currentPolygonEntity && viewer && viewer.entities) {
      viewer.entities.remove(currentPolygonEntity);
    }
    currentPolygonEntity = addPolygon(currentPolygonPoints.value, color);
  };

  const clearCurrentLine = () => {
    if (currentLineEntity && viewer && viewer.entities) {
      viewer.entities.remove(currentLineEntity);
      currentLineEntity = null;
    }
  };

  // 清除所有完成的面
  const clearAllPolygons = () => {
    completedPolygonEntities.value.forEach((entity) => {
      if (viewer && viewer.entities) {
        viewer.entities.remove(entity);
      }
    });
    completedPolygonEntities.value = [];
  };

  const isViewerInitialized = ref(false);



  // 新增检测鼠标是否在实体上的方法，添加一个可选参数来控制检测范围
  const checkMouseOverEntity = (event: MouseEvent, pickRadius: number = 5): string | null => {
    if (!cesiumContainer.value || !viewer) {
      return null;
    }

    const scene = viewer.scene;
    const position = new Cesium.Cartesian2(event.clientX, event.clientY);
    // 使用 drillPick 方法在指定半径内进行拾取
    const pickedObjects = scene.drillPick(position, pickRadius, pickRadius);

    if (pickedObjects && pickedObjects.length > 0) {
      for (const pickedObject of pickedObjects) {
        if (Cesium.defined(pickedObject) && pickedObject.id) {
          return pickedObject.id;
        }
      }
    }
    return null;
  };

// 获取实体类型
const getEntityType = (entity: Cesium.Entity | undefined) => {
  
  if (!entity) {
    
    return '未知类型';
  }
  if (entity.point) {
    
    return '点';
  } else if (entity.polyline) {
    
    return '线';
  } else if (entity.polygon) {
    
    return '面';
  }
  
  return '未知类型';
};


// 改变点的颜色
const changePointColor = (entity: Cesium.Entity, newColor: Cesium.Color) => {
  if (entity.point) {
    entity.point.color = new Cesium.ConstantProperty(newColor);
  }
};

// 改变线的颜色
const changeLineColor = (entity: Cesium.Entity, newColor: Cesium.Color) => {
  if (entity.polyline) {
    entity.polyline.material = new Cesium.ColorMaterialProperty(newColor);
  }
};

// 改变面的颜色
const changePolygonColor = (entity: Cesium.Entity, newColor: Cesium.Color) => {
  if (entity.polygon) {
    entity.polygon.material = new Cesium.ColorMaterialProperty(newColor.withAlpha(0.5));
  }
};

// 根据实体类型改变颜色
const changeEntityColor = (entityId: string | Cesium.Entity, newColor: Cesium.Color) => {
  let entity: Cesium.Entity | undefined;
  if (typeof entityId === 'string') {
    if (!viewer) {
      return;
    }
    entity = viewer.entities.getById(entityId);
  } else {
    entity = entityId;
  }

  if (!entity) {
    return;
  }

  let mainEntity: Cesium.Entity = entity;

  // 检查是否是线标签实体
  const lineLabelIndex = lineLabelEntities.value.indexOf(entity);
  if (lineLabelIndex > -1) {
    mainEntity = completedLineEntities.value[lineLabelIndex];
  }

  // 检查是否是面标签实体
  const polygonLabelIndex = polygonLabelEntities.value.indexOf(entity);
  if (polygonLabelIndex > -1) {
    mainEntity = completedPolygonEntities.value[polygonLabelIndex];
  }

  const entityType = getEntityType(mainEntity);

  switch (entityType) {
    case '点':
      changePointColor(mainEntity, newColor);
      break;
    case '线':
      changeLineColor(mainEntity, newColor);
      break;
    case '面':
      changePolygonColor(mainEntity, newColor);
      break;
    default:
      break;
  }
};

// 获取实体标签
const getEntityLabel = (entity: Cesium.Entity | undefined) => {
  
  if (!entity) {
    
    return '未知标签';
  }

  // 先尝试从当前实体获取标签
  
  if (entity.label && entity.label.text) {
    const textProperty = entity.label.text;
    
    if (typeof textProperty.getValue === 'function') {
      const labelValue = textProperty.getValue(Cesium.JulianDate.now());
      
      return labelValue;
    }
  } else {
    
  }

  const entityType = getEntityType(entity);
  let labelEntities: Cesium.Entity[] = [];
  let completedEntities: Cesium.Entity[] = [];

  switch (entityType) {
    case '线':
      labelEntities = lineLabelEntities.value;
      completedEntities = completedLineEntities.value;
      break;
    case '面':
      labelEntities = polygonLabelEntities.value;
      completedEntities = completedPolygonEntities.value;
      break;
    default:
      
      return '未知标签';
  }

  // 查找传入实体在 completedEntities 中的索引
  const index = completedEntities.indexOf(entity);
  if (index > -1) {
    const labelEntity = labelEntities[index];
    
    if (labelEntity && labelEntity.label && labelEntity.label.text) {
      const textProperty = labelEntity.label.text;
      if (typeof textProperty.getValue === 'function') {
        const labelValue = textProperty.getValue(Cesium.JulianDate.now());
        
        return labelValue;
      }
    } else {
      
    }
  } else {

  }

  
  return '未知标签';
};

const getEntityColor = (entity: Cesium.Entity | undefined) => {
  if (!entity) {
    return '未知颜色';
  }
  try {
    // 处理点实体
    if (entity.point) {
      const color = entity.point.color.getValue(Cesium.JulianDate.now());
      return color.toCssColorString();
    } 
    // 处理线实体
    else if (entity.polyline) {
      const material = entity.polyline.material.getValue(Cesium.JulianDate.now());
      if (material instanceof Cesium.ColorMaterialProperty) {
        const color = material.color.getValue(Cesium.JulianDate.now());
        return color.toCssColorString();
      } else if (material instanceof Cesium.Color) {
        return material.toCssColorString();
      } else if (material && material.color instanceof Cesium.Color) {
        return material.color.toCssColorString();
      } 
    } 
    // 处理面实体
    else if (entity.polygon) {
      const material = entity.polygon.material.getValue(Cesium.JulianDate.now());
      if (material instanceof Cesium.ColorMaterialProperty) {
        const color = material.color.getValue(Cesium.JulianDate.now());
        return color.toCssColorString();
      } else if (material instanceof Cesium.Color) {
        return material.toCssColorString();
      } else if (material && material.color instanceof Cesium.Color) {
        return material.color.toCssColorString();
      } 
    } 
    // 处理标签实体对应的实际实体颜色
    else {
      const lineLabelIndex = lineLabelEntities.value.indexOf(entity as Cesium.Entity);
      if (lineLabelIndex > -1) {
        const mainLineEntity = completedLineEntities.value[lineLabelIndex];
        if (mainLineEntity && mainLineEntity.polyline) {
          const lineMaterial = mainLineEntity.polyline.material.getValue(Cesium.JulianDate.now());
          if (lineMaterial instanceof Cesium.ColorMaterialProperty) {
            const color = lineMaterial.color.getValue(Cesium.JulianDate.now());
            return color.toCssColorString();
          } else if (lineMaterial instanceof Cesium.Color) {
            return lineMaterial.toCssColorString();
          } else if (lineMaterial && lineMaterial.color instanceof Cesium.Color) {
            return lineMaterial.color.toCssColorString();
          } 
        } 
      }

      const polygonLabelIndex = polygonLabelEntities.value.indexOf(entity as Cesium.Entity);
      if (polygonLabelIndex > -1) {
        const mainPolygonEntity = completedPolygonEntities.value[polygonLabelIndex];
        if (mainPolygonEntity && mainPolygonEntity.polygon) {
          const polygonMaterial = mainPolygonEntity.polygon.material.getValue(Cesium.JulianDate.now());
          if (polygonMaterial instanceof Cesium.ColorMaterialProperty) {
            const color = polygonMaterial.color.getValue(Cesium.JulianDate.now());
            return color.toCssColorString();
          } else if (polygonMaterial instanceof Cesium.Color) {
            return polygonMaterial.toCssColorString();
          } else if (polygonMaterial && polygonMaterial.color instanceof Cesium.Color) {
            return polygonMaterial.color.toCssColorString();
          } 
        } 
      }
    }
  } catch (error) {
    showNotification(1, '获取实体颜色时发生错误', 3000);
  }
  return '未知颜色';
};



// 获取鼠标选中实体的标签、颜色和类型信息的方法
const getSelectedEntityInfo = (entityId: string | Cesium.Entity) => {
 

  let entity: Cesium.Entity | undefined;

  if (typeof entityId === 'string') {
    // 确保 entityId 是字符串类型
    const validEntityId = typeof entityId === 'string' || typeof entityId === 'number' ? String(entityId) : null;
    if (validEntityId) {
      entity = viewer?.entities.getById(validEntityId);
    } else {
    }
  } else {
    entity = entityId;
  }

  let mainEntity: Cesium.Entity | undefined = entity;

  // 检查是否是线标签实体
  const lineLabelIndex = lineLabelEntities.value.indexOf(entity as Cesium.Entity);
  if (lineLabelIndex > -1) {
    mainEntity = completedLineEntities.value[lineLabelIndex];
  }

  // 检查是否是面标签实体
  const polygonLabelIndex = polygonLabelEntities.value.indexOf(entity as Cesium.Entity);
  if (polygonLabelIndex > -1) {
    mainEntity = completedPolygonEntities.value[polygonLabelIndex];
  }

  const label = getEntityLabel(mainEntity);
  const color = getEntityColor(mainEntity);
  const type = getEntityType(mainEntity);


  return {
    label,
    color,
    type
  };
};




  return {
    cesiumContainer,
    selectedMap,
    mapProviders,
    handleMapChange,
    resetMap,
    initializeCesium,
    destroyCesium,
    longitude,
    latitude,
    height,
    longitude_num,
    latitude_num,
    height_num,
    addPoint,
    addPointByLatLon,
    switchTo2D,
    switchTo3D,
    getCameraGroundElevation,
    CameraZoomIn,
    CameraZoomOut,
    addLine,
    addLineByLatLon,
    clearCurrentLine,
    completeCurrentLine,
    completeCurrentPolygon,
    clearAllPolygons,
    updateCurrentPolygon,
    addPolygon,
    currentPolygonPoints,
    checkMouseOverEntity,
    deleteEntity, // 导出删除实体的方法
    isViewerInitialized,
    getSelectedEntityInfo,
    changePointColor,
    changeLineColor,
    changePolygonColor,
    changeEntityColor
  };
};









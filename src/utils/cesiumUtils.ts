import * as Cesium from 'cesium';
import { ref } from 'vue';
import { mapProviders } from './mapProviders';
import NotificationBox from '../components/NotificationBox.vue';
import { showNotification } from '../utils/notification';
import { sendEntityInfoViaWebSocket } from './websocketUtils';

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
// 修改 deleteEntity 函数
const deleteEntity = (entityId: string | Cesium.Entity) => {
  if (!isViewerInitialized.value || !viewer) {
    showNotification(0, '初始化出错 功能无法使用', 3000);
    return;
  }

  let entity: Cesium.Entity | undefined;
  if (typeof entityId === 'string') {
    entity = viewer.entities.getById(entityId);
  } else {
    entity = entityId;
  }

  if (!entity) {
    showNotification(1, '未找到要删除的实体', 3000);
    return;
  }

  let mainEntity: Cesium.Entity = entity;
  let labelEntity: Cesium.Entity | undefined;
  let entityLabel = '未知实体';
  const entityType = getEntityType(entity);

  // 检查传入的是否是标签实体
  if (entity.label) {
    // 尝试找到对应的主实体
    const allEntities = [
      ...completedLineEntities.value,
      ...completedPolygonEntities.value,
      ...ellipsoidCylinderEntities.value,
      ...polygonPrismEntities.value 
    ];

    mainEntity = allEntities.find(main => {
      const foundLabel = getEntityLabelEntity(main);
      return foundLabel === entity;
    }) || entity;
    labelEntity = entity;
  } else {
    labelEntity = getEntityLabelEntity(entity);
  }

  if (labelEntity) {
    if (labelEntity.label && labelEntity.label.text) {
      const textProperty = labelEntity.label.text;
      if (typeof textProperty.getValue === 'function') {
        entityLabel = textProperty.getValue(Cesium.JulianDate.now());
      }
    }
    // 从对应数组中移除标签实体
    const removeFromArray = (arr: Cesium.Entity[], item: Cesium.Entity) => {
      const index = arr.indexOf(item);
      if (index > -1) {
        arr.splice(index, 1);
      }
    };

    removeFromArray(lineLabelEntities.value, labelEntity);
    removeFromArray(polygonLabelEntities.value, labelEntity);
    removeFromArray(ellipsoidCylinderLabelEntities.value, labelEntity);
    removeFromArray(polygonPrismLabelEntities.value, labelEntity);

    viewer.entities.remove(labelEntity);
  }

  // 从对应数组中移除主实体并更新计数器
  switch (entityType) {
    case '线':
      const lineIndex = completedLineEntities.value.indexOf(mainEntity);
      if (lineIndex > -1) {
        completedLineEntities.value.splice(lineIndex, 1);
        lineCounter.value--;
      }
      break;
    case '面':
      const polygonIndex = completedPolygonEntities.value.indexOf(mainEntity);
      if (polygonIndex > -1) {
        completedPolygonEntities.value.splice(polygonIndex, 1);
        polygonCounter.value--;
      }
      break;
    case '椭圆柱':
      const ellipsoidIndex = ellipsoidCylinderEntities.value.indexOf(mainEntity);
      console.log('椭圆柱索引:', ellipsoidIndex);
      if (ellipsoidIndex > -1) {
        ellipsoidCylinderEntities.value.splice(ellipsoidIndex, 1);
        lineCounter.value--;
      }
      break;
    case '多边形棱柱':
      const prismIndex = polygonPrismEntities.value.indexOf(mainEntity);
      if (prismIndex > -1) {
        polygonPrismEntities.value.splice(prismIndex, 1);
        polygonCounter.value--;
      }
      break;
  }

  viewer.entities.remove(mainEntity);
  showNotification(0, `已成功删除实体: ${entityLabel}`, 3000);
};

  // 添加标记点
  const addPoint = (position: Cesium.Cartesian3, color: Cesium.Color) => {
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

      // 从 position 解算出经纬度和高度
      const cartographic = Cesium.Cartographic.fromCartesian(position);
      const lat = Cesium.Math.toDegrees(cartographic.latitude);
      const lon = Cesium.Math.toDegrees(cartographic.longitude);
      const groundHeight = cartographic.height;

      // 调用 WebSocket 发送信息
      sendEntityInfoViaWebSocket('点', `点${pointCounter.value}`,String(color), lat, lon, groundHeight);
    } else {
      showNotification(1, '初始化出错，功能无法使用', 3000);
    }
  };

  // 根据经纬度和高度添加点
  const addPointByLatLon = (lat: number, lon: number, height: number, color: Cesium.Color) => {
    const position = Cesium.Cartesian3.fromDegrees(lon, lat, height);
    // 格式化经纬度
    const formattedLat = formatCoordinate(lat, true);
    const formattedLon = formatCoordinate(lon, false);
    showNotification(0, `成功在 ${formattedLat},${formattedLon},${Math.round(height)}m 添加点`, 3000);
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
    const absValue = Math.abs(value).toFixed(7);
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
      showNotification(1, '操作过于频繁，请稍后再试', 3000);
      return;
    }
    lastZoomInTime = now;

    // 手动更新高度信息
    updateHeightInfo();

    if (viewer) {
      // 检查当前对地高度，如果小于等于 50 米则不进行放大操作
      if (height_num.value && height_num.value <= 50) {
        showNotification(1, '当前对地高度过低，无法放大', 3000);
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
    // 检查是否为多边形棱柱
    if (entity.polygon.extrudedHeight) {
      return '多边形棱柱';
    }
    return '面';
  } else if (entity.ellipsoid) {
    // 检查是否为椭圆柱
    return '椭圆柱';
  }
  
  return '未知类型';
};

// ... 已有代码 ...

// 改变点的标签名字
const changePointLabel = (entity: Cesium.Entity, newLabel: string) => {
  if (entity.label) {
    // 使用 ConstantProperty 包装字符串
    entity.label.text = new Cesium.ConstantProperty(newLabel);
  } 
};

// 改变线的标签名字
const changeLineLabel = (entity: Cesium.Entity, newLabel: string) => {
  const labelEntity = getEntityLabelEntity(entity);
  if (labelEntity) {
    if (labelEntity.label) {
      labelEntity.label.text = new Cesium.ConstantProperty(newLabel);
      showNotification(0, '线标签修改成功', 3000);
    } else {
      showNotification(1, '该线标签实体没有标签属性，无法修改', 3000);
    }
  } else {
    showNotification(1, '未找到对应的线标签实体，无法修改标签', 3000);
  }
};

// 改变面的标签名字
const changePolygonLabel = (entity: Cesium.Entity, newLabel: string) => {
  const labelEntity = getEntityLabelEntity(entity);
  if (labelEntity) {
    if (labelEntity.label) {
      labelEntity.label.text = new Cesium.ConstantProperty(newLabel);
    } 
  } else {
    showNotification(1, '未找到对应的面标签实体，无法修改标签', 3000);
  }
};

// 改变椭圆柱的标签名字
const changeEllipsoidCylinderLabel = (entity: Cesium.Entity, newLabel: string) => {
  console.log('开始执行 changeEllipsoidCylinderLabel 函数');
  console.log('传入的实体:', entity);
  console.log('新的标签:', newLabel);

  const labelEntity = getEntityLabelEntity(entity);
  console.log('获取到的标签实体:', labelEntity);

  if (labelEntity) {
    if (labelEntity.label) {
      console.log('准备修改标签实体的文本为:', newLabel);
      labelEntity.label.text = new Cesium.ConstantProperty(newLabel);
      showNotification(0, '椭圆柱标签修改成功', 3000);
      console.log('椭圆柱标签修改成功');
    } else {
      showNotification(1, '该椭圆柱标签实体没有标签属性，无法修改', 3000);
      console.error('该椭圆柱标签实体没有标签属性，无法修改');
    }
  } else {
    showNotification(1, '未找到对应的椭圆柱标签实体，无法修改标签', 3000);
    console.error('未找到对应的椭圆柱标签实体，无法修改标签');
  }
};

// 改变多边形棱柱的标签名字
const changePolygonPrismLabel = (entity: Cesium.Entity, newLabel: string) => {
  const labelEntity = getEntityLabelEntity(entity);
  if (labelEntity) {
    if (labelEntity.label) {
      labelEntity.label.text = new Cesium.ConstantProperty(newLabel);
      showNotification(0, '多边形棱柱标签修改成功', 3000);
    } else {
      showNotification(1, '该多边形棱柱标签实体没有标签属性，无法修改', 3000);
    }
  } else {
    showNotification(1, '未找到对应的多边形棱柱标签实体，无法修改标签', 3000);
  }
};

// 根据实体类型改变标签名字
const changeEntityLabel = (entityId: string | Cesium.Entity, newLabel: string) => {
  let entity: Cesium.Entity | undefined;
  // 根据 entityId 类型获取实体
  if (typeof entityId === 'string') {
    if (!viewer) {
      showNotification(1, 'Viewer 未初始化，无法修改标签', 3000);
      return;
    }
    entity = viewer.entities.getById(entityId);
  } else {
    entity = entityId;
  }

  if (!entity) {
    showNotification(1, '未找到对应的实体，无法修改标签', 3000);
    return;
  }

  const entityType = getEntityType(entity);

  switch (entityType) {
    case '点':
      changePointLabel(entity, newLabel);
      showNotification(0, '点标签修改成功', 3000);
      break;
    case '线':
      changeLineLabel(entity, newLabel);
      break;
    case '面':
      changePolygonLabel(entity, newLabel);
      break;
    case '椭圆柱':
      changeEllipsoidCylinderLabel(entity, newLabel);
      break;
    case '多边形棱柱':
      changePolygonPrismLabel(entity, newLabel);
      break;
    default:
      showNotification(1, '未识别的实体类型，无法修改标签', 3000);
  }
};

// ... 已有代码 ...

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
    case '椭圆柱':
      if (mainEntity.ellipsoid) {
        mainEntity.ellipsoid.material = new Cesium.ColorMaterialProperty(newColor);
      }
      break;
    case '多边形棱柱':
      if (mainEntity.polygon) {
        mainEntity.polygon.material = new Cesium.ColorMaterialProperty(newColor);
      }
      break;
    default:
      break;
  }
};


// 获取实体的标签实体
const getEntityLabelEntity = (entity: Cesium.Entity | undefined): Cesium.Entity | undefined => {
  console.group('getEntityLabelEntity 调试信息组');
  console.log('传入的实体:', entity);

  if (!entity) {
    console.log('传入的实体为 undefined，返回 undefined');
    console.groupEnd();
    return undefined;
  }

  const entityType = getEntityType(entity);
  console.log('实体类型:', entityType);

  let index: number;
  switch (entityType) {
    case '线':
      index = completedLineEntities.value.indexOf(entity);
      if (index > -1) {
        const labelEntity = lineLabelEntities.value[index];
        console.log('通过索引找到线标签实体:', labelEntity);
        console.groupEnd();
        return labelEntity;
      }
      break;
    case '面':
      index = completedPolygonEntities.value.indexOf(entity);
      if (index > -1) {
        const labelEntity = polygonLabelEntities.value[index];
        console.log('通过索引找到面标签实体:', labelEntity);
        console.groupEnd();
        return labelEntity;
      }
      break;
    case '椭圆柱':
      index = ellipsoidCylinderEntities.value.indexOf(entity);
      console.log('椭圆柱实体在 ellipsoidCylinderEntities 中的索引:', index, 'ellipsoidCylinderLabelEntities:', ellipsoidCylinderLabelEntities.value);
      if (index > -1 && index < ellipsoidCylinderLabelEntities.value.length) {
        const labelEntity = ellipsoidCylinderLabelEntities.value[index];
        console.log('通过索引找到椭圆柱标签实体:', labelEntity);
        console.groupEnd();
        return labelEntity;
      }
      break;
    case '多边形棱柱':
      index = polygonPrismEntities.value.indexOf(entity);
      if (index > -1 && index < polygonPrismLabelEntities.value.length) {
        const labelEntity = polygonPrismLabelEntities.value[index];
        console.log('通过索引找到多边形棱柱标签实体:', labelEntity);
        console.groupEnd();
        return labelEntity;
      }
      break;
    default:
      console.log('未识别的实体类型，返回 undefined');
      console.groupEnd();
      return undefined;
  }

  console.log('未找到标签实体，返回 undefined');
  console.groupEnd();
  return undefined;
};

// 修改后的 getEntityLabel 函数，使用新封装的函数
const getEntityLabel = (entity: Cesium.Entity | undefined) => {
  console.group('getEntityLabel 调试信息组');
  console.log('传入的实体:', entity);

  if (!entity) {
    console.log('传入的实体为 undefined，返回 "未知标签"');
    console.groupEnd();
    return '未知标签';
  }

  // 先尝试从当前实体获取标签
  if (entity.label && entity.label.text) {
    const textProperty = entity.label.text;
    console.log('当前实体有标签属性，尝试获取标签文本属性:', textProperty);
    if (typeof textProperty.getValue === 'function') {
      const label = textProperty.getValue(Cesium.JulianDate.now());
      console.log('从当前实体获取到标签:', label);
      console.groupEnd();
      return label;
    }
  }

  const labelEntity = getEntityLabelEntity(entity);
  console.log('通过 getEntityLabelEntity 获取到的标签实体:', labelEntity);
  if (labelEntity && labelEntity.label && labelEntity.label.text) {
    const textProperty = labelEntity.label.text;
    console.log('标签实体有标签属性，尝试获取标签文本属性:', textProperty);
    if (typeof textProperty.getValue === 'function') {
      const label = textProperty.getValue(Cesium.JulianDate.now());
      console.log('从标签实体获取到标签:', label);
      console.groupEnd();
      return label;
    }
  }

  console.log('未获取到标签，返回 "未知标签"');
  console.groupEnd();
  return '未知标签';
};


const getEntityColor = (entity: Cesium.Entity | undefined) => {
  if (!entity) {
    return '未知颜色';
  }

  // 先判断是否为标签实体，如果是则找到对应的主实体
  const mainEntity = (() => {
    const lineLabelIndex = lineLabelEntities.value.indexOf(entity);
    if (lineLabelIndex > -1) {
      return completedLineEntities.value[lineLabelIndex];
    }

    const polygonLabelIndex = polygonLabelEntities.value.indexOf(entity);
    if (polygonLabelIndex > -1) {
      return completedPolygonEntities.value[polygonLabelIndex];
    }

    const ellipsoidCylinderLabelIndex = ellipsoidCylinderLabelEntities.value.indexOf(entity);
    if (ellipsoidCylinderLabelIndex > -1) {
      return ellipsoidCylinderEntities.value[ellipsoidCylinderLabelIndex];
    }

    const polygonPrismLabelIndex = polygonPrismLabelEntities.value.indexOf(entity);
    if (polygonPrismLabelIndex > -1) {
      return polygonPrismEntities.value[polygonPrismLabelIndex];
    }

    return entity;
  })();

  try {
    // 处理点实体
    if (mainEntity.point) {
      const color = mainEntity.point.color.getValue(Cesium.JulianDate.now());
      return color.toCssColorString();
    } 
    // 处理线实体
    else if (mainEntity.polyline) {
      const material = mainEntity.polyline.material.getValue(Cesium.JulianDate.now());
      if (material instanceof Cesium.ColorMaterialProperty) {
        const color = material.color.getValue(Cesium.JulianDate.now());
        return color.toCssColorString();
      } else if (material instanceof Cesium.Color) {
        return material.toCssColorString();
      } else if (material && material.color instanceof Cesium.Color) {
        return material.color.toCssColorString();
      } 
    } 
    // 处理面实体和多边形棱柱
    else if (mainEntity.polygon) {
      const material = mainEntity.polygon.material.getValue(Cesium.JulianDate.now());
      if (material instanceof Cesium.ColorMaterialProperty) {
        const color = material.color.getValue(Cesium.JulianDate.now());
        return color.toCssColorString();
      } else if (material instanceof Cesium.Color) {
        return material.toCssColorString();
      } else if (material && material.color instanceof Cesium.Color) {
        return material.color.toCssColorString();
      } 
    } 
    // 处理椭圆柱
    else if (mainEntity.ellipsoid) {
      const material = mainEntity.ellipsoid.material.getValue(Cesium.JulianDate.now());
      if (material instanceof Cesium.ColorMaterialProperty) {
        const color = material.color.getValue(Cesium.JulianDate.now());
        return color.toCssColorString();
      } else if (material instanceof Cesium.Color) {
        return material.toCssColorString();
      } else if (material && material.color instanceof Cesium.Color) {
        return material.color.toCssColorString();
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
    const validEntityId = typeof entityId === 'string' || typeof entityId === 'number' ? String(entityId) : null;
    if (validEntityId) {
      entity = viewer?.entities.getById(validEntityId);
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

  // 检查是否是椭圆柱标签实体
  const ellipsoidCylinderLabelIndex = ellipsoidCylinderLabelEntities.value.indexOf(entity as Cesium.Entity);
  if (ellipsoidCylinderLabelIndex > -1) {
    mainEntity = ellipsoidCylinderEntities.value[ellipsoidCylinderLabelIndex];
  }

  // 检查是否是多边形棱柱标签实体
  const polygonPrismLabelIndex = polygonPrismLabelEntities.value.indexOf(entity as Cesium.Entity);
  if (polygonPrismLabelIndex > -1) {
    mainEntity = polygonPrismEntities.value[polygonPrismLabelIndex];
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

// 新增存储椭圆柱标签实体和多边形棱柱标签实体的数组
const ellipsoidCylinderLabelEntities = ref<Cesium.Entity[]>([]);
const polygonPrismLabelEntities = ref<Cesium.Entity[]>([]);
// 新增存储椭圆柱和多边形棱柱主实体的数组
const ellipsoidCylinderEntities = ref<Cesium.Entity[]>([]);
const polygonPrismEntities = ref<Cesium.Entity[]>([]);
// 修改创建椭圆柱的函数，使用 EllipsoidGraphics 并添加标签
const addEllipsoidCylinder = (
  position: Cesium.Cartesian3,
  semiMinorAxis: number,
  semiMajorAxis: number,
  height: number,
  color: Cesium.Color
) => {
  if (viewer && viewer.entities) {
    const ellipsoidEntity = viewer.entities.add({
      position: position,
      ellipsoid: {
        radii: new Cesium.Cartesian3(semiMajorAxis, semiMinorAxis, height / 2),
        material: new Cesium.ColorMaterialProperty(color) 
      }
    });

    const ellipsoidNormal = Cesium.Cartesian3.normalize(position, new Cesium.Cartesian3());
    const topPosition = Cesium.Cartesian3.add(
      position,
      Cesium.Cartesian3.multiplyByScalar(ellipsoidNormal, height / 2, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );

    const labelEntity = viewer.entities.add({
      position: topPosition,
      point: {
        pixelSize: 0,
        color: Cesium.Color.TRANSPARENT
      },
      label: {
        text: `椭圆柱${++lineCounter.value}`,
        font: '14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -10)
      }
    });

    ellipsoidCylinderEntities.value.push(ellipsoidEntity);
    ellipsoidCylinderLabelEntities.value.push(labelEntity);
    console.log('椭圆柱实体和标签实体已成功添加', ellipsoidCylinderLabelEntities.value);
  } else {
    showNotification(1, '初始化出错，功能无法使用', 3000);
  }
};

// 修改后的根据经纬度和高度添加椭圆柱函数
const addEllipsoidCylinderByLatLon = async (
  lat: number,
  lon: number,
  groundHeight: number, // 新增参数：椭圆圆心的对地高度
  height: number,
  semiMinorAxis: number,
  semiMajorAxis: number,
  color: Cesium.Color
) => {
  // 计算椭圆柱的实际位置，将其放置在指定的地面高度之上
  const position = Cesium.Cartesian3.fromDegrees(lon, lat, groundHeight + height / 2);
  addEllipsoidCylinder(position, semiMinorAxis, semiMajorAxis, height, color);
  const formattedLat = formatCoordinate(lat, true);
  const formattedLon = formatCoordinate(lon, false);
  showNotification(0, `成功在纬度 ${formattedLat}，经度 ${formattedLon}，地面高度 ${Math.round(groundHeight)}m 创建椭圆柱`, 3000);
};

// 创建指定边数的直棱柱
const addRegularPrism = (
  centerLat: number,
  centerLon: number,
  groundHeight: number,
  extrudedHeight: number,
  radius: number,
  sides: number,
  color: Cesium.Color
) => {
  if (viewer && viewer.entities && sides >= 3 && sides <= 8) {
    const points: Array<{ lat: number; lon: number; height: number }> = [];
    const centerPosition = Cesium.Cartesian3.fromDegrees(centerLon, centerLat, groundHeight);
    const cartographic = Cesium.Cartographic.fromCartesian(centerPosition);
    const centerLonRad = cartographic.longitude;
    const centerLatRad = cartographic.latitude;

    for (let i = 0; i < sides; i++) {
      const angle = (2 * Math.PI * i) / sides;
      const newLon = centerLonRad + (radius * Math.cos(angle)) / Cesium.Ellipsoid.WGS84.maximumRadius;
      const newLat = centerLatRad + (radius * Math.sin(angle)) / Cesium.Ellipsoid.WGS84.maximumRadius;
      points.push({
        lat: Cesium.Math.toDegrees(newLat),
        lon: Cesium.Math.toDegrees(newLon),
        height: groundHeight
      });
    }

    const polygonPrismEntity = viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(
          points.map(point => Cesium.Cartesian3.fromDegrees(point.lon, point.lat, point.height))
        ),
        // 底面高度为 groundHeight，向上延伸 extrudedHeight
        height: groundHeight, 
        extrudedHeight: groundHeight + extrudedHeight, 
        material: new Cesium.ColorMaterialProperty(color)
      }
    });

    // 计算棱柱顶部中心位置
    const topCenterPosition = Cesium.Cartesian3.fromDegrees(centerLon, centerLat, groundHeight + extrudedHeight);

    const labelEntity = viewer.entities.add({
      position: topCenterPosition, // 使用顶部中心位置
      point: {
        pixelSize: 0,
        color: Cesium.Color.TRANSPARENT
      },
      label: {
        text: `多边形棱柱${++polygonCounter.value}`,
        font: '14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -10)
      }
    });

    polygonPrismEntities.value.push(polygonPrismEntity);
    polygonPrismLabelEntities.value.push(labelEntity);
    showNotification(0, `成功在纬度 ${formatCoordinate(centerLat, true)}，经度 ${formatCoordinate(centerLon, false)} 创建多边形棱柱`, 3000);
  } else {
    showNotification(1, '初始化出错或边数不在 3 到 8 之间，无法创建多边形棱柱', 3000);
  }
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
    changeEntityColor,
    changeEntityLabel,
    addEllipsoidCylinder, // 导出创建椭圆柱的函数
    addEllipsoidCylinderByLatLon, // 导出根据经纬度创建椭圆柱的函数
    addRegularPrism // 导出创建多边形棱柱的函数
  };
};









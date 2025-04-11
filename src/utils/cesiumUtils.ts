import * as Cesium from 'cesium';
import { ref } from 'vue';
import { mapProviders } from './mapProviders';
import { usePopup } from './popup';
import Camera from 'cesium/Source/Scene/Camera';
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI1MWU0NGIwMS1hZWQyLTRlODktYmExMi04NzJjOGYyMTE5Y2EiLCJpZCI6MjkxMjMzLCJpYXQiOjE3NDQzNjQ4ODF9.huZ7JqhHqnuhQWzjP6qxJIS6LCUPpbArJqZd1JzTfUA' // 替换实际token
const { success } = usePopup();
Cesium.Ion.defaultAccessToken = token; // 设置Cesium Ion的访问令牌
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
    resetMap()
    // 初始化默认地图
    loadMap('arcgis');

    viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK); 


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
        longitude.value = `${Math.abs(long).toFixed(4)}° ${long >= 0 ? 'E' : 'W'}`;
        latitude.value = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;

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
      // 1. 清除所有影像图层
      viewer.imageryLayers.removeAll();

      // 2. 重新加载默认底图（网页1的初始化逻辑复用）
      loadMap('arcgis');

      // 3. 重置相机视角（网页5的视角控制方案）
      // viewer.camera.flyTo({
      //   destination: Cesium.Cartesian3.fromDegrees(116.4074, 39.9095, 100000),
      //   orientation: {
      //     heading: Cesium.Math.toRadians(0),
      //     pitch: Cesium.Math.toRadians(-90)
      //   }
      // });

      // 4. 同步下拉菜单状态（网页6的UI控制逻辑）
      selectedMap.value = 'arcgis';

      success('初始化完成');
      console.log('Cesium Viewer has been reset to default state.');
    }
  };

  // 销毁Cesium Viewer
  const destroyCesium = () => {
    if (viewer) {
      viewer.destroy();
      viewer = undefined;
    }
  };

  // 添加标记点
  const addPoint = ( position: Cesium.Cartesian3, color: Cesium.Color) => {
    console.log('viewer:' + viewer);
    if (viewer && viewer.entities) {
        viewer.entities.add({
            position: position,
            point: {
                pixelSize: 10,
                color: color
            }
        });
    }else{
      console.log('viewer or viewer.entities is undefined');
    }
  };


  // 根据经纬度和高度添加点
  const addPointByLatLon = (lat: number, lon: number, height: number, color: Cesium.Color) => {
    // 检查高度值是否合理
    if (height < 0) {
      console.error('Invalid height value. Height must be a positive number.');
      return;
    }
    const position = Cesium.Cartesian3.fromDegrees(lon, lat, height);
    console.log('Adding point at lat:', lat, 'lon:', lon, 'height:', height);
    addPoint(position, color);
  
  };


  //切换3D/2D视图
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
    CameraZoomOut

    
    
  };
};

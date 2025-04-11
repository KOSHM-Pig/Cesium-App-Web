import * as Cesium from 'cesium';
import { ref } from 'vue';
import { mapProviders } from './mapProviders';
import { usePopup } from './popup';

const { success } = usePopup();

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
      creditContainer: document.createElement("div")
    });

    // 隐藏版权信息
    const creditContainer = viewer.cesiumWidget.creditContainer as HTMLElement;
    creditContainer.style.display = 'none';
    //去除双击放大事件
    viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    //初始化地图
    resetMap()


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
        height_num.value = alt;

        
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


  // 根据经纬度添加点
  const addPointByLatLon = (lat: number, lon: number, color: Cesium.Color) => {
    const position = Cesium.Cartesian3.fromDegrees(lon, lat);
    console.log('Adding point at lat:', lat, 'lon:', lon);
    addPoint(position, color);
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
    addPointByLatLon

    
  };
};

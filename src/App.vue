<template>
  <div class="map-container">
    <!-- 工具栏 -->
    <div class="toolbar">
      <!-- 颜色选择器 -->
      <input
        type="color"
        class="tool color-picker"
        v-model="selectedColor"
        @change="handleColorChange"
      />
      <div
        class="tool"
        :class="{ 'active': activeTool === tool.name }"
        v-for="(tool, index) in tools"
        :key="index"
        @click="handleToolClick(tool.name)"
      >
        <span>{{ tool.name }}</span>
        
      </div>
      
    </div>
    <!-- 地图控制部分 -->
    <div class="map-control">
      <select v-model="selectedMap" @change="handleMapChange">
        <option v-for="(provider, key) in mapProviders" :key="key" :value="key">
          {{ provider.name }}
        </option>
      </select>
      <button @click="resetMap" class="map-control__button">初始化</button>
    </div>
    <!-- Cesium 容器 -->
    <div
      ref="cesiumContainer"
      class="cesium-container"
      :style="{ cursor: activeTool === '标点' || activeTool === '标线' || activeTool === '标面' ? 'crosshair' : 'default' }"
      @click="handleMapClick"
    >
      <!-- 放大缩小按钮组 -->
      <div class="zoom-buttons">
        <button @click="CameraZoomOut" class="map-control__button">放大</button>
        <button @click="CameraZoomIn" class="map-control__button">缩小</button>
      </div>
    </div>
    <!-- 状态栏 -->
    <div class="status-bar">
      <span class="status-item">{{ longitude || 'N/A' }}</span>
      <span class="status-item">{{ latitude || 'N/A' }}</span>
      <span class="status-item">{{ height || 'N/A' }}</span>
      <span></span>
      <!-- 2D/3D 切换按钮 -->
      <button @click="toggleViewMode" class="status-item view-mode-button">
        {{ currentViewMode === '2D' ? '切换到 2D' : '切换到 3D' }}
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, onUnmounted, ref } from 'vue';
import { useCesium } from './utils/cesiumUtils';
import * as Cesium from 'cesium';
import './App.css';
import NotificationBox from './components/NotificationBox.vue';
import { showNotification } from './utils/notification';

export default defineComponent({
  components: {
    NotificationBox
  },
  setup() {
    const {
      cesiumContainer,
      selectedMap,
      mapProviders,
      handleMapChange,
      resetMap,
      initializeCesium,
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
      addLineByLatLon,
      clearCurrentLine,
      completeCurrentLine,
      // 引入标面相关方法
      completeCurrentPolygon,
      clearAllPolygons,
      updateCurrentPolygon,
      addPolygon,
      currentPolygonPoints // 引入 currentPolygonPoints
    } = useCesium();

    const activeTool = ref<string | null>(null);
    const tools = [
      { name: '标点' },
      { name: '标线' },
      { name: '标面' }
    ];
    const showAnnularMenu = ref(false);
    const currentLinePoints = ref<Array<{ lat: number; lon: number; height: number }>>([]);
     // 颜色选择器相关状态
     const selectedColor = ref('#ff0000'); // 默认红色

    // 处理颜色变化
    const handleColorChange = () => {
      // 这里可以添加使用新颜色的逻辑，例如更新标点、标线的颜色
      showNotification(0,'标记颜色已更改');
    };

    const handleToolClick = (toolName: string) => {
      if (toolName === '标线') {
        if (activeTool.value === '标线') {
          // 结束当前画线
          if (currentLinePoints.value.length >= 2) {
            completeCurrentLine();
          }
          currentLinePoints.value = [];
          activeTool.value = null;
        } else {
          // 开始新的画线
          activeTool.value = '标线';
        }
      } else if (toolName === '标面') {
        if (activeTool.value === '标面') {
          // 结束当前标面
          completeCurrentPolygon();
          activeTool.value = null;
        } else {
          // 开始新的标面
          activeTool.value = '标面';
          // 清空之前的标面点
          currentPolygonPoints.value = [];
        }
      } else {
        // 切换到其他工具，结束当前画线和标面
        if (activeTool.value === '标线' && currentLinePoints.value.length >= 2) {
          completeCurrentLine();
        }
        if (activeTool.value === '标面') {
          completeCurrentPolygon();
          currentPolygonPoints.value = [];
        }
        currentLinePoints.value = [];
        activeTool.value = activeTool.value === toolName ? null : toolName;
      }
    };

    const handleMapClick = () => {
      if (activeTool.value === '标点') {
        if (longitude_num.value !== null && latitude_num.value !== null) {
          const groundHeight = getCameraGroundElevation(latitude_num.value, longitude_num.value) || 0;
          addPointByLatLon(
            latitude_num.value,
            longitude_num.value,
            groundHeight,
            Cesium.Color.fromCssColorString(selectedColor.value)
          );
        }
      } else if (activeTool.value === '标线') {
        if (longitude_num.value !== null && latitude_num.value !== null) {
          const groundHeight = getCameraGroundElevation(latitude_num.value, longitude_num.value) || 0;
          currentLinePoints.value.push({
            lat: latitude_num.value,
            lon: longitude_num.value,
            height: groundHeight
          });

          // 清除当前正在绘制的线
          clearCurrentLine();

          if (currentLinePoints.value.length >= 2) {
            // 重新绘制当前正在绘制的线
            addLineByLatLon(currentLinePoints.value,Cesium.Color.fromCssColorString(selectedColor.value));
          }
        }
      } else if (activeTool.value === '标面') {
        if (longitude_num.value !== null && latitude_num.value !== null) {
          const groundHeight = getCameraGroundElevation(latitude_num.value, longitude_num.value) || 0;
          // 收集标面的点
          currentPolygonPoints.value.push({
            lat: latitude_num.value,
            lon: longitude_num.value,
            height: groundHeight
          });
          // 更新多边形
          updateCurrentPolygon(Cesium.Color.fromCssColorString(selectedColor.value));
        }
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (activeTool.value === '标线' && currentLinePoints.value.length > 0) {
          // 移除最后一个点
          currentLinePoints.value.pop();
          // 清除当前正在绘制的线
          clearCurrentLine();
          if (currentLinePoints.value.length >= 2) {
            // 重新绘制线
            addLineByLatLon(currentLinePoints.value,Cesium.Color.fromCssColorString(selectedColor.value));
          }
        } else if (activeTool.value === '标面' && currentPolygonPoints.value.length > 0) {
          if (currentPolygonPoints.value.length < 4) {
            // 点数少于 3 个，直接清空所有标记点
            console.log('清除所有标记点');
            console.log(currentPolygonPoints.value);
            currentPolygonPoints.value = [];
            updateCurrentPolygon(Cesium.Color.fromCssColorString(selectedColor.value));
          } else {
            // 移除最后一个标面的点
            currentPolygonPoints.value.pop();
            updateCurrentPolygon(Cesium.Color.fromCssColorString(selectedColor.value));
          }
        }
      }
    };

    // 定义当前视图模式
    const currentViewMode = ref('3D');

    // 切换视图模式的方法
    const toggleViewMode = () => {
      if (currentViewMode.value === '2D') {
        switchTo2D();
        currentViewMode.value = '3D';
      } else {
        switchTo3D();
        currentViewMode.value = '2D';
      }
    };




    onMounted(() => {
      initializeCesium();
      window.addEventListener('keydown', handleKeyDown);
    });

    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeyDown);
    });

    return {
      cesiumContainer,
      selectedMap,
      mapProviders,
      handleMapChange,
      resetMap,
      longitude,
      latitude,
      height,
      tools,
      activeTool,
      handleToolClick,
      handleMapClick,
      currentViewMode,
      toggleViewMode,
      CameraZoomIn,
      CameraZoomOut,
      selectedColor,
      handleColorChange
    };
  },
});
</script>




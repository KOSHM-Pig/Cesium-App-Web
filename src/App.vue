<template>
  <div class="map-container">
    <!-- 新增工具栏 -->
    <div class="toolbar">
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
    <div class="map-control">
      <select v-model="selectedMap" @change="handleMapChange">
        <option v-for="(provider, key) in mapProviders" :key="key" :value="key">
          {{ provider.name }}
        </option>
      </select>
      <button @click="resetMap" class="map-control__button">初始化</button>
    </div>
    <div
      ref="cesiumContainer"
      class="cesium-container"
      :style="{ cursor: activeTool === '标点' || activeTool === '标线' ? 'crosshair' : 'default' }"
      @click="handleMapClick"
    >
      <!-- 新增放大缩小按钮组 -->
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
      <!-- 添加 2D/3D 切换按钮 -->
      <button @click="toggleViewMode" class="status-item view-mode-button">
        {{ currentViewMode === '2D' ? '切换到 2D' : '切换到 3D' }}
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from 'vue';
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
      completeCurrentLine
    } = useCesium();

    const activeTool = ref<string | null>(null);
    const tools = [
      { name: '标点' },
      { name: '标线' },
      { name: '标面' }
    ];
    const showAnnularMenu = ref(false);

    const currentLinePoints = ref<Array<{ lat: number; lon: number; height: number }>>([]);

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
      } else {
        // 切换到其他工具，结束当前画线
        if (activeTool.value === '标线' && currentLinePoints.value.length >= 2) {
          completeCurrentLine();
        }
        currentLinePoints.value = [];
        activeTool.value = activeTool.value === toolName ? null : toolName;
      }
    };

    const handleMapClick = () => {
      if (activeTool.value === '标线') {
        if (longitude_num.value && latitude_num.value) {
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
            const entity = addLineByLatLon(currentLinePoints.value);
            // 这里假设返回的实体赋值给 currentLineEntity，在 cesiumUtils 中处理
          }
        }
      } else if (activeTool.value === '标点') {
        if (longitude_num.value && latitude_num.value) {
          addPointByLatLon(
            latitude_num.value,
            longitude_num.value,
            getCameraGroundElevation(latitude_num.value, longitude_num.value) || 0,
            Cesium.Color.RED
          );
        }
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && activeTool.value === '标线' && currentLinePoints.value.length > 0) {
        // 移除最后一个点
        currentLinePoints.value.pop();
        // 清除当前正在绘制的线
        clearCurrentLine();
        if (currentLinePoints.value.length >= 2) {
          // 重新绘制线
          addLineByLatLon(currentLinePoints.value);
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
      const viewer = initializeCesium();
      window.addEventListener('keydown', handleKeyDown);
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
      CameraZoomOut
    };
  },
});
</script>

<style scoped>
.cesium-container {
  position: relative; 
  width: 100%; 
  height: 100vh; 
  overflow: hidden; 
}

.zoom-buttons {
  position: absolute;
  bottom: 20px;
  left: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 1; /* 确保按钮显示在其他元素之上 */
}
</style>

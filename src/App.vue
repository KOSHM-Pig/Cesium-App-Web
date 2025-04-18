<template>
  <div class="map-container">
    <!-- 选中实体信息框，根据 isOverEntity 控制显示隐藏，使用 v-show 结合 CSS 过渡 -->
      <div :class="['selected-entity-info', { fade: isOverEntity, 'fade-out': !isOverEntity }]" v-if="isEntityVisible">
    <p>
      <span class="info-label">标签: </span>
      <span class="info-value">{{ entityInfo.label }}</span>
    </p>
    <p>
      <span class="info-label">颜色: </span>
      <span class="info-value">{{ entityInfo.color }}</span>
      <span 
        class="color-block" 
        :style="{ backgroundColor: entityInfo.color === '未知颜色' ? '#ccc' : entityInfo.color }"
      ></span>
    </p>
    <p>
      <span class="info-label">类型: </span>
      <span class="info-value">{{ entityInfo.type }}</span>
    </p>
  </div>
    <!-- 其他代码保持不变 -->
    <RadialMenu 
      ref="radialMenuRef"
      :deleteEntity="deleteEntity" 
      :isViewerInitialized="isViewerInitialized"
      :changeEntityColor="changeEntityColor"
      :selectedColor="selectedColor"
      :changeEntityLabel="changeEntityLabel"
      
    />
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

        <!-- 棱柱创建数据编辑框 -->
    <div
      class="prism-editor"
      v-if="showPrismEditor"
      >
      <div class="editor-item">
        <label>边数：</label>
        <select v-model="selectedSides" @change="handleSidesChange">
          <option v-for="side in [3, 4, 5, 6, 7, 8]" :key="side" :value="side">
            {{ side }}
          </option>
        </select>
      </div>
      <div class="editor-item">
        <label>棱柱高度：</label>
        <input
          type="number"
          v-model.number="prismHeight"
          placeholder="输入棱柱高度"
        />
      </div>
      <div class="editor-item">
        <label>底面宽度：</label>
        <input
          type="number"
          v-model.number="prismRadius"
          placeholder="输入底面宽度"
        />
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
      :style="{
        cursor: activeTool ? 'crosshair' : (isOverEntity ? 'pointer' : 'default')
      }"
      @click="handleMapClick($event)"
      @mousemove="handleMouseMove"
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
import RadialMenu from './components/RadialMenu.vue';

export default defineComponent({
  components: {
    NotificationBox,
    RadialMenu
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
      completeCurrentPolygon,
      clearAllPolygons,
      updateCurrentPolygon,
      addPolygon,
      currentPolygonPoints,
      checkMouseOverEntity,
      deleteEntity,
      isViewerInitialized,
      changeEntityColor,
      changeEntityLabel,
      getSelectedEntityInfo, // 新增获取实体信息方法
      addEllipsoidCylinderByLatLon, // 导出根据经纬度创建椭圆柱的函数
      addRegularPrism
    } = useCesium();

    const activeTool = ref<string | null>(null);
    const tools = [
      { name: '标点' },
      { name: '标线' },
      { name: '标面' },
      { name: '圆柱' },
      { name: '棱柱' },
    ];
    const showAnnularMenu = ref(false);
    const currentLinePoints = ref<Array<{ lat: number; lon: number; height: number }>>([]);
    const selectedEntityId = ref<string | null>(null); // 记录当前选中的实体 ID
    const selectedColor = ref('#ff0000'); // 默认红色
    const isOverEntity = ref(false); // 用于跟踪鼠标是否在实体上
    const entityInfo = ref({
      label: '未知标签',
      color: '未知颜色',
      type: '未知类型'
    }); // 新增实体信息

    const selectedSides = ref(4); // 默认四边形棱柱
    const showPrismEditor = ref(false); // 控制棱柱编辑框显示隐藏
    const prismHeight = ref(100); // 棱柱高度
    const prismRadius = ref(50); // 棱柱底面宽度
    
    // 引用 RadialMenu 组件实例
    const radialMenuRef = ref<InstanceType<typeof RadialMenu> | null>(null);

    // 定义菜单位置
    const menuPosition = ref<{ x: number; y: number } | null>(null);

    const handleSidesChange = () => {
      showNotification(0, `已选择创建 ${selectedSides.value} 边形棱柱`, 3000);
    };
    // 处理颜色变化
    const handleColorChange = () => {
      // 这里可以添加使用新颜色的逻辑，例如更新标点、标线的颜色
      showNotification(0,'标记颜色已更改');
    };

    // 处理 RadialMenu 发出的改变颜色事件
    const handleChangeColor = (entityId: string) => {
      const viewer = window['viewer']; // 假设 viewer 已经挂载到 window 上，可根据实际情况修改
      const entity = viewer.entities.getById(entityId);
      if (entity) {
        const color = Cesium.Color.fromCssColorString(selectedColor.value);
        changeEntityColor(entity, color);
      }
    };

    const handleToolClick = (toolName: string) => {
      // 切换到其他工具，结束当前画线和标面
      if (activeTool.value === '标线' && currentLinePoints.value.length >= 2) {
        completeCurrentLine();
      }
      if (activeTool.value === '标面') {
        completeCurrentPolygon();
        currentPolygonPoints.value = [];
      }
      currentLinePoints.value = [];

      if (activeTool.value === toolName) {
        // 再次点击相同工具，关闭工具并隐藏棱柱编辑框
        activeTool.value = null;
        showPrismEditor.value = false;
      } else {
        // 切换到新工具
        activeTool.value = toolName;
        // 如果新工具是棱柱，显示编辑框；否则隐藏编辑框
        showPrismEditor.value = toolName === '棱柱';
      }
    };
const handleMapClick = (event: MouseEvent) => {
  // 检查是否处于标记状态
  if (activeTool.value) {
    if (longitude_num.value !== null && latitude_num.value !== null) {
      const groundHeight = getCameraGroundElevation(latitude_num.value, longitude_num.value) || 0;
      switch (activeTool.value) {
        case '标点':
          addPointByLatLon(
            latitude_num.value,
            longitude_num.value,
            groundHeight,
            Cesium.Color.fromCssColorString(selectedColor.value)
          );
          break;
        case '标线':
          currentLinePoints.value.push({
            lat: latitude_num.value,
            lon: longitude_num.value,
            height: groundHeight
          });
          // 清除当前正在绘制的线
          clearCurrentLine();
          if (currentLinePoints.value.length >= 2) {
            // 重新绘制当前正在绘制的线
            addLineByLatLon(currentLinePoints.value, Cesium.Color.fromCssColorString(selectedColor.value));
          }
          break;
        case '标面':
          // 收集标面的点
          currentPolygonPoints.value.push({
            lat: latitude_num.value,
            lon: longitude_num.value,
            height: groundHeight
          });
          // 更新多边形
          updateCurrentPolygon(Cesium.Color.fromCssColorString(selectedColor.value));
          break;
        case '圆柱':
          const lat = latitude_num.value;
          const lon = longitude_num.value;
          const height = 100; // 椭圆柱高度
          const semiMinorAxis = 20; // 半短轴
          const semiMajorAxis = 30; // 半长轴
          const color = Cesium.Color.fromCssColorString(selectedColor.value);
          addEllipsoidCylinderByLatLon(lat, lon,groundHeight, height, semiMinorAxis, semiMajorAxis, color);
          // activeTool.value = null; // 创建完成后取消激活工具
          break;
        case '棱柱':
        if (longitude_num.value !== null && latitude_num.value !== null) {
          //const extrudedHeight = 100; // 棱柱高度
          const radius = 50; // 棱柱底面半径
          addRegularPrism(
            latitude_num.value,
            longitude_num.value,
            groundHeight,
            prismHeight.value,
            prismRadius.value,
            selectedSides.value,
            Cesium.Color.fromCssColorString(selectedColor.value)
          );
        }
          // activeTool.value = null; // 创建完成后取消激活工具
          break;
      }
    } else {
      if (activeTool.value === '圆柱') {
        showNotification(1, '经纬度信息不足，无法创建椭圆柱', 3000);
      } else if (activeTool.value === '棱柱') {
        showNotification(1, '经纬度信息不足，无法创建多边形棱柱', 3000);
      }
    }
    return;
  }

  // 可以调整这个值来改变检测范围
  const pickRadius = 10; 
  const entityId = checkMouseOverEntity(event, pickRadius);
  if (entityId) {
    const position = { x: event.clientX, y: event.clientY };
    if (radialMenuRef.value) {
      radialMenuRef.value.openMenu(position, entityId);
    }
  } else {
    if (radialMenuRef.value) {
      radialMenuRef.value.closeMenu();
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
            currentPolygonPoints.value = [];
            updateCurrentPolygon(Cesium.Color.fromCssColorString(selectedColor.value));
            showNotification(1,'标面点数不足，请重新绘制');
          } else {
            // 移除最后一个标面的点
            currentPolygonPoints.value.pop();
            updateCurrentPolygon(Cesium.Color.fromCssColorString(selectedColor.value));
            showNotification(2,'已删除上一个点');
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
    const isEntityVisible = ref(false); // 控制信息框是否渲染
    let hoverTimeout: number | null = null; // 定义隐藏信息框的定时器
let showTimeout: number | null = null; // 定义显示信息框的定时器

const handleMouseMove = (event: MouseEvent) => {
      if (activeTool.value) {
        // 标记状态下不处理鼠标悬停实体逻辑
        return;
      }

      const pickRadius = 7; 
      const entityId = checkMouseOverEntity(event, pickRadius);

      if (entityId) {
        // 鼠标在实体上，立即改变光标状态
        isOverEntity.value = true;

        // 清除隐藏信息框的定时器
        if (hoverTimeout) {
          clearTimeout(hoverTimeout);
          hoverTimeout = null;
        }

        isEntityVisible.value = true;

        // 更新实体信息
        entityInfo.value = getSelectedEntityInfo(Object(entityId));
      } else {
        // 鼠标不在实体上，立即改变光标状态
        isOverEntity.value = false;

        // 清除显示信息框的定时器
        if (showTimeout) {
          clearTimeout(showTimeout);
          showTimeout = null;
        }

        // 延迟隐藏信息框
        if (!hoverTimeout) {
          hoverTimeout = window.setTimeout(() => {
            isEntityVisible.value = false; // 隐藏信息框
            hoverTimeout = null;
          }, 300); // 延迟 300 毫秒隐藏
        }
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
      handleColorChange,
      isOverEntity,
      handleMouseMove,
      radialMenuRef,
      menuPosition,
      deleteEntity,
      selectedEntityId,
      isViewerInitialized,
      isEntityVisible,
      handleChangeColor,
      changeEntityColor,
      changeEntityLabel,
      entityInfo, // 导出实体信息
      selectedSides,
      handleSidesChange,
      showPrismEditor,
      prismHeight,
      prismRadius
    };
  },
});
</script>
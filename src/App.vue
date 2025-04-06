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
      :style="{ cursor: activeTool === '标点' ? 'crosshair' : 'default' }"
      @click="handleMapClick"
      @contextmenu.prevent="handleRightClick" 
    ></div>
    <!-- 状态栏 -->
    <div class="status-bar">
      <span class="status-item">{{ longitude || 'N/A' }}</span>
      <span class="status-item">{{ latitude || 'N/A' }}</span>
      <span class="status-item">{{ height || 'N/A' }}</span>
    </div>
    <!-- 引入 BAnnularMenu 组件 -->
    <BAnnularMenu
      v-if="showMenu"
      :menuList="menuList"
      :initCurrent="initCurrent"
      :sliderColor="sliderColor"
      :latitude="latitude"
      :longitude="longitude"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from 'vue';
import { useCesium } from './utils/cesiumUtils';
import * as Cesium from 'cesium';
import BAnnularMenu from './components/BAnnularMenu.vue'; // 引入 BAnnularMenu 组件
import './App.css';

export default defineComponent({
  components: {
    BAnnularMenu
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
      addPointByLatLon
    } = useCesium();

    // 定义激活的工具
    const activeTool = ref<string | null>(null);

    // 定义工具栏工具
    const tools = [
      { name: '标点' },
      { name: '标线' },
      { name: '标面' }
    ];

    const handleToolClick = (toolName: string) => {
      // 切换激活的工具
      activeTool.value = activeTool.value === toolName ? null : toolName;
    };

    const handleMapClick = () => {
      if (activeTool.value === '标点') {
        console.log('经纬度数据: '+ longitude_num.value+ '   '+latitude_num.value+ '   ' +height_num.value);
        if (longitude_num && latitude_num) {
          addPointByLatLon(Number(latitude_num.value),Number(longitude_num.value), Cesium.Color.RED);
        }
      }
    };

    const showMenu = ref(false); // 控制 BAnnularMenu 组件的显示与隐藏
    const menuList = [
      { name: '照明', index: 0 },
      { name: '空调', index: 1 },
      { name: '安防', index: 2 },
      { name: '消防', index: 3 },
      { name: '管线', index: 4 },
      { name: '生产', index: 5 },
      { name: '安全', index: 5 },
      { name: '消防', index: 3 }
    ];
    const initCurrent = 1;
    const sliderColor = '#FFD824';

    const handleRightClick = () => {
      if (longitude.value && latitude.value) {


          showMenu.value = true; // 显示 BAnnularMenu 组件
        
      }
    };

    onMounted(() => {
      initializeCesium();
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
      showMenu,
      menuList,
      initCurrent,
      sliderColor,
      handleRightClick
    };
  },
});
</script>

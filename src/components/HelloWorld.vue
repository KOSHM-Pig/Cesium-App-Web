<template>
  <div class="cesium-container">
    <vc-viewer 
      :logo="false" 
      @ready="handleViewerReady"
    >
      <vc-layer-imagery 
        :imageryProvider="imageryProvider"
      />
    </vc-viewer>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { VcViewer, VcLayerImagery } from 'vue-cesium'
import 'vue-cesium/dist/style.css'

// 卫星影像配置
const imageryProvider = ref(null)

// 初始化完成回调
const handleViewerReady = (cesiumInstance) => {
  const { Cesium } = cesiumInstance
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIzY2YwOGNkMy01MDRiLTQ3NTItYjNkYi1iMTY1ZDM3MGRiZWYiLCJpZCI6MjkxMjMzLCJpYXQiOjE3NDM5MDg0NTJ9.vF--OfvLQ1doTE963AvMviFF89a7ZgCkkAUBTr0q1RY' // 替换实际token
  
  // 创建影像提供商
  imageryProvider.value = new Cesium.UrlTemplateImageryProvider({
    url: '../public/map/tiles/{z}/{x}/{y}.jpg', // 调整为您实际的瓦片路径
    minimumLevel: 0,
    maximumLevel: 18,
    credit: 'Satellite Imagery'
  })

  // 可选：添加默认视角
  cesiumInstance.viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(116.39, 39.9, 150000)
  })
}
</script>

<style scoped>
.cesium-container {
  width: 100vw;
  height: 100vh;
  position: relative;
}

/* 隐藏版权信息 */
:deep(.cesium-widget-credits) {
  display: none !important;
}

/* 调整控件位置 */
:deep(.cesium-viewer-toolbar) {
  top: 20px;
  right: 20px;
}
</style>
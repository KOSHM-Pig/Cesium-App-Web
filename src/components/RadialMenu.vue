<template>
  <div 
    v-if="isMenuOpen" 
    id="radial-menu-container" 
    :style="{ 
      zIndex: 9999,
      top: menuPosition?.y + 'px',
      left: menuPosition?.x + 'px',
      transform: 'translate(0, 0)'
    }"
  >
    <div id="close-button-wrapper" @click="closeMenu">
      <button id="close-button">×</button>
    </div>
    <div id="menu-items">
      <div
        v-for="(item, index) in menuItems"
        :key="index"
        class="menu-item"
        :style="{ transform: `rotate(${getItemAngle(index)}deg)` }"
        @click="selectItem(item)"
      >
        <div class="item-text">
          {{ item.label }}
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import { showNotification } from '../utils/notification';
import * as Cesium from 'cesium';

export default defineComponent({
  props: {
    deleteEntity: {
      type: Function,
      required: true
    },
    isViewerInitialized: {
      type: Boolean,
      required: true
    },
    changeEntityColor: {
      type: Function,
      required: true
    },
    selectedColor: {
      type: String,
      required: true
    }
  },
  setup(props) {
    // 菜单状态
    const isMenuOpen = ref(false);
    // 菜单位置
    const menuPosition = ref<{ x: number; y: number } | null>(null);
    // 选中的实体 ID
    const selectedEntityId = ref<string | null>(null);

    // 定义菜单项
    const menuItems = [
      {
        label: '删除',
        action: () => handleDelete(),
      },
      {
        label: '改变颜色',
        action: () => handleChangeColor(),
      },
      { label: '功能3', action: () => showNotification(0, '功能3执行') },
      { label: '功能4', action: () => showNotification(0, '功能4执行') },
      { label: '功能5', action: () => showNotification(0, '功能5执行') },
      { label: '功能6', action: () => showNotification(0, '功能6执行') },
      { label: '功能7', action: () => showNotification(0, '功能7执行') },
      { label: '功能8', action: () => showNotification(0, '功能8执行') },
    ];

    // 处理删除操作
    const handleDelete = () => {
      if (!props.isViewerInitialized) {
        showNotification(1, 'Cesium Viewer 未初始化，暂无法删除', 3000);
        return;
      }
      if (selectedEntityId.value) {
        props.deleteEntity(selectedEntityId.value);
        closeMenu();
      }
    };
    // 处理改变颜色操作
    const handleChangeColor = () => {
      if (!props.isViewerInitialized) {
        showNotification(1, 'Cesium Viewer 未初始化，暂无法改变颜色', 3000);
        return;
      }
      if (selectedEntityId.value) {
        const color = Cesium.Color.fromCssColorString(props.selectedColor);
        props.changeEntityColor(selectedEntityId.value, color);
        showNotification(0, '颜色修改成功', 3000);
      }
      closeMenu();
    };

    // 关闭菜单
    const closeMenu = () => {
      isMenuOpen.value = false;
      selectedEntityId.value = null;
    };

    // 打开菜单
    const openMenu = (position: { x: number; y: number }, entityId: string) => {
      menuPosition.value = position;
      selectedEntityId.value = entityId;
      isMenuOpen.value = true;
    };

    // 选择菜单项
    const selectItem = (item: { action: () => void }) => {
      item.action();
    };

    // 计算菜单项角度
    const getItemAngle = (index: number) => {
      return (360 / menuItems.length) * index;
    };

    return {
      isMenuOpen,
      menuItems,
      closeMenu,
      openMenu,
      selectItem,
      menuPosition,
      getItemAngle
    };
  },
});
</script>

<style scoped>
/* 菜单容器样式 */
#radial-menu-container {
  position: fixed;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background-color: rgba(128, 128, 128, 0.5);
  overflow: hidden;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
}

/* 关闭按钮包装器样式 */
#close-button-wrapper {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 50%;
  height: 50%;
  border-radius: 50%;
  z-index: 2;
  pointer-events: auto;
}

/* 关闭按钮样式 */
#close-button {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) !important;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  border-radius: 50%;
  width: 100%;
  height: 100%;
  font-size: 24px;
  cursor: pointer;
  z-index: 1;
  pointer-events: none;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
}

/* 关闭按钮悬停样式 */
#close-button:hover {
  transform: translate(-50%, -50%) scale(1.1) !important;
  background: rgba(0, 0, 0, 0.7);
}

/* 菜单项容器样式 */
#menu-items {
  width: 100%;
  height: 100%;
  position: relative;
}

/* 菜单项样式 */
.menu-item {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  clip-path: polygon(50% 50%, 100% 50%, 100% 0);
  transform-origin: 50% 50%;
  cursor: pointer;
  background: linear-gradient(to right, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
  transition: all 0.3s ease;
}

/* 菜单项悬停样式 */
.menu-item:hover {
  background: linear-gradient(to right, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.15));
  transform: scale(1.05);
}

/* 菜单项文本样式 */
.item-text {
  position: absolute;
  top: 50%;
  left: 75%;
  transform: translateY(-250%);
  color: white;
  font-weight: bold;
  font-size: 12px;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
}
</style>
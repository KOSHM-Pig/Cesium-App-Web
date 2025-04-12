<template>
  <div v-if="isMenuOpen" id="radial-menu-container" :style="{ zIndex: 9999 }">
    <!-- 修改关闭按钮结构 -->
    <div id="close-button-wrapper" @click="closeMenu">
      <button id="close-button">×</button>
    </div>
    <!-- 环形菜单项 -->
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

export default defineComponent({
  name: 'RadialMenu',
  setup() {
    const isMenuOpen = ref(false); // 初始状态设置为关闭

    const menuItems = [
      { label: '功能1', action: () => console.log('功能1执行') },
      { label: '功能2', action: () => console.log('功能2执行') },
      { label: '功能3', action: () => console.log('功能3执行') },
      { label: '功能4', action: () => console.log('功能4执行') },
      { label: '功能5', action: () => console.log('功能5执行') },
      { label: '功能6', action: () => console.log('功能6执行') },
      { label: '功能7', action: () => console.log('功能7执行') },
      { label: '功能8', action: () => console.log('功能8执行') },
    ];

    const closeMenu = () => {
      isMenuOpen.value = false;
    };

    // 新增打开菜单方法
    const openMenu = () => {
      isMenuOpen.value = true;
    };

    const selectItem = (item) => {
      item.action();
      closeMenu();
    };

    const getItemAngle = (index) => {
      return (360 / menuItems.length) * index;
    };

    return {
      isMenuOpen,
      menuItems,
      closeMenu,
      openMenu, // 导出打开菜单方法
      selectItem,
      getItemAngle,
    };
  },
});
</script>

<style scoped>
#radial-menu-container {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background-color: rgba(128, 128, 128, 0.5);
  overflow: hidden;
  margin-top: 20px;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
}

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

#close-button {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) !important;
  background: rgba(0,0,0,0.5);
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

#close-button:hover {
  transform: translate(-50%, -50%) scale(1.1) !important;
  background: rgba(0, 0, 0, 0.7);
}

#menu-items {
  width: 100%;
  height: 100%;
  position: relative;
}

.menu-item {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  /* 修改clip-path为精确的八分之一圆 */
  clip-path: polygon(50% 50%, 100% 50%, 100% 0);
  transform-origin: 50% 50%;
  cursor: pointer;
  background: linear-gradient(to right, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
  transition: all 0.3s ease;
}

.menu-item:hover {
  background: linear-gradient(to right, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.15));
  transform: scale(1.05);
}

.item-text {
  position: absolute;
  top: 50%;
  left: 75%; /* 调整文字距离圆心的水平位置 */
  transform: translateY(calc(-250% )) ; /* 垂直居中 */
  color: white;
  font-weight: bold;
  font-size: 12px;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
    /* 增加负向 translateY 偏移，这里设置为 -30%，可根据实际情况调整 */
}
</style>

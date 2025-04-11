<template>
  <transition name="fade">
    <div v-if="visible" class="notification-container">
      <div class="notification-box" :class="{ 'slide-down': isSliding }">
        <span class="notification-icon">{{ icon }}</span>
        <p class="notification-message">{{ message }}</p>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
  message: {
    type: String,
    required: true
  },
  notificationType: {
    type: Number,
    required: true
  },
  duration: {
    type: Number,
    default: 3000
  }
});

const emits = defineEmits(['close']);

const visible = ref(true);
const isSliding = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;
let slideTimer: ReturnType<typeof setTimeout> | null = null;

const icons = {
  0: '✅',
  1: '❌',
  2: 'ℹ️'
};

const icon = computed(() => icons[props.notificationType]);

const closeNotification = () => {
  visible.value = false;
  emits('close');
};

onMounted(() => {
  // 触发缓动效果
  slideTimer = setTimeout(() => {
    isSliding.value = true;
  }, 0);

  timer = setTimeout(() => {
    closeNotification();
  }, props.duration);
});

onUnmounted(() => {
  if (timer) {
    clearTimeout(timer);
  }
  if (slideTimer) {
    clearTimeout(slideTimer);
  }
});
</script>

<style scoped>
.notification-container {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  top: 0;
  z-index: 1000;
}

.notification-box {
  background-color: rgba(255, 255, 255, 1);
  padding: 20px;
  border-radius: 4px;
  border-color: rgb(0,0,0);

  transform: translateY(-100%);
  opacity: 0;
  transition: all 0.3s ease;
}

.notification-box.slide-down {
  transform: translateY(20px);
  opacity: 1;
}

.notification-icon {
  margin-right: 10px;
  font-size: 20px;
}

.notification-message {
  margin: 0;
  font-size: 16px;
  display: inline;
  color: black;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
<template>
    <teleport to="body">
      <transition name="slide-up">
        <div 
          v-if="visible"
          class="popup-container"
          :class="[typeClass]"
          @mouseenter="pauseTimer"
          @mouseleave="resumeTimer">
          <span class="icon">{{ typeIcon }}</span>
          <span class="message">{{ message }}</span>
        </div>
      </transition>
    </teleport>
  </template>
  
  <script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  
  const props = defineProps({
    type: {
      type: String as () => 'success' | 'error' | 'question' | 'info',
      default: 'info'
    },
    message: {
      type: String,
      required: true
    },
    duration: {
      type: Number,
      default: 5000
    }
  })
  
  const visible = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null
  
  const typeIcon = computed(() => {
    const icons = {
      success: '✅',
      error: '❌',
      question: '❓',
      info: 'ℹ️'
    }
    return icons[props.type] || icons.info
  })
  
  const typeClass = computed(() => `popup-${props.type}`)
  
  function show() {
    visible.value = true
    startTimer()
    console.log('Popup shown:', props.message)
  }
  
  function hide() {
    visible.value = false
    clearTimer()
  }
  
  function startTimer() {
    timer = setTimeout(hide, props.duration)
  }
  
  function clearTimer() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }
  
  function pauseTimer() {
    clearTimer()
  }
  
  function resumeTimer() {
    startTimer()
  }
  
  defineExpose({ show, hide })
  </script>
  
  <style scoped>
  .popup-container {
    position: fixed;
    bottom: -150px;
    right: 20px;
    width: 300px;
    background: white;
    border: 2px solid #ccc;
    border-radius: 10px;
    box-shadow: 0 0 10px rgba(0,0,0,0.2);
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 1000;
    transition: bottom 0.5s ease;
  }
  
  .popup-success {
    border-color: #4CAF50;
    background: #f0fff4;
  }
  
  .popup-error {
    border-color: #ff5252;
    background: #fff5f5;
  }
  
  .popup-question {
    border-color: #2196F3;
    background: #e3f2fd;
  }
  
  .slide-up-enter-active {
    transition: all 0.5s ease;
  }
  
  .slide-up-enter-from {
    bottom: -150px;
  }
  .slide-up-enter-to {
    bottom: 20px;
  }
  
  .icon {
    font-size: 1.5em;
  }
  
  .message {
    flex: 1;
    word-break: break-word;
  }
  </style>
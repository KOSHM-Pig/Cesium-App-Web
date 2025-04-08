<!-- App.vue -->
<template>
  <div>
    <p>连接状态: {{ isConnected ? '已连接' : '已断开' }}</p>
    <p>最新消息: {{ messageData || '暂无' }}</p>
    <button @click="send({ type: 'ping', timestamp: Date.now() })">
      发送测试消息
    </button>
  </div>
</template>

<script setup>
import useWebSocket from '@/composables/useWebSocket'

const { isConnected, messageData, send } = useWebSocket('wss://echo.websocket.events')
</script>
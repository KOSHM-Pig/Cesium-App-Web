// src/composables/useWebSocket.js
import { ref, reactive, onMounted, onBeforeUnmount, toRefs } from 'vue'

export default function useWebSocket(url) {
  // 响应式状态
  const state = reactive({
    isConnected: false,
    messageData: null,
    reconnectCount: 0
  })
  
  const maxReconnectAttempts = 5
  let reconnectTimer = null
  let ws = null

  // 初始化连接
  const connect = () => {
    ws = new WebSocket(url)//写入地址

    ws.onopen = () => {
      console.log('WebSocket connected')
      state.isConnected = true
      state.reconnectCount = 0 // 重置重连计数器
    }

    ws.onmessage = (event) => {
      try {
        // 假设接收JSON数据
        state.messageData = JSON.parse(event.data)
      } catch (error) {
        console.error('消息解析失败:', error)
        state.messageData = event.data
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket错误:', error)
      ws.close() // 触发onclose处理重连
    }

    ws.onclose = (event) => {
      state.isConnected = false
      if (event.code !== 1000) { // 非正常关闭
        autoReconnect()
      }
    }
  }

  // 自动重连逻辑
  const autoReconnect = () => {
    if (state.reconnectCount < maxReconnectAttempts) {
      state.reconnectCount++
      reconnectTimer = setTimeout(() => {
        console.log(`尝试重连 (${state.reconnectCount}/${maxReconnectAttempts})`)
        connect()
      }, 5000) // 5秒后重连
    } else {
      console.error('达到最大重连次数，放弃连接')
    }
  }

  // 发送消息
  const send = (data) => {
    if (ws?.readyState === WebSocket.OPEN) {
      const payload = typeof data === 'string' ? data : JSON.stringify(data)
      ws.send(payload)
    } else {
      console.error('消息发送失败：连接未就绪')
    }
  }

  // 组件挂载时连接
  onMounted(connect)
  
  // 组件卸载时清理
  onBeforeUnmount(() => {
    ws?.close(1000) // 1000表示正常关闭
    clearTimeout(reconnectTimer)
  })

  return { 
    ...toRefs(state),
    send
  }
}
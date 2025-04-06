// src/utils/popup.ts
import { createApp, h, ref } from 'vue'
import PopupNotification from '../components/PopupNotification.vue'

type NotificationType = 'success' | 'error' | 'question' | 'info'

const createNotification = (type: NotificationType, message: string, duration = 5000) => {
  const container = document.createElement('div')
  const instance = createApp({
    render() {
      return h(PopupNotification, {
        type,
        message,
        duration,
        onClose: () => {
          instance.unmount()
          document.body.removeChild(container)
        }
      })
    }
  })
  
  document.body.appendChild(container)
  instance.mount(container)
  return instance
}

export const usePopup = () => ({
  success: (message: string, duration?: number) => createNotification('success', message, duration),
  error: (message: string, duration?: number) => createNotification('error', message, duration),
  question: (message: string, duration?: number) => createNotification('question', message, duration),
  info: (message: string, duration?: number) => createNotification('info', message, duration)
})
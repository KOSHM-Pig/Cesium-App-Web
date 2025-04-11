import { createApp } from 'vue';
import NotificationBox from '../components/NotificationBox.vue';

// 用于存储当前正在显示的通知实例
let currentNotificationApp: ReturnType<typeof createApp> | null = null;
let currentNotificationDiv: HTMLDivElement | null = null;

interface NotificationOptions {
  message: string;
  notificationType: number;
  duration?: number;
  onClose?: () => void;
}

// 封装一个函数用于销毁当前通知
const destroyCurrentNotification = () => {
  if (currentNotificationApp && currentNotificationDiv) {
    try {
      currentNotificationApp.unmount();
      if (currentNotificationDiv.parentNode) {
        currentNotificationDiv.parentNode.removeChild(currentNotificationDiv);
      }
    } catch (error) {
      console.error('销毁通知时出错:', error);
    }
    currentNotificationApp = null;
    currentNotificationDiv = null;
  }
};

export function showNotification(notificationType: number, message: string, duration = 3000) {
  // 先销毁当前正在显示的通知
  destroyCurrentNotification();

  const options: NotificationOptions = {
    message,
    notificationType,
    duration
  };

  const div = document.createElement('div');
  document.body.appendChild(div);

  const app = createApp(NotificationBox, {
    ...options,
    onClose: () => {
      options.onClose?.();
      try {
        app.unmount();
        if (div.parentNode) {
          div.parentNode.removeChild(div);
        }
      } catch (error) {
        console.error('通知关闭时出错:', error);
      }
      currentNotificationApp = null;
      currentNotificationDiv = null;
    }
  });

  app.mount(div);

  // 更新当前正在显示的通知实例
  currentNotificationApp = app;
  currentNotificationDiv = div;
}

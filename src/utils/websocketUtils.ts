import { showNotification } from './notification';

export const sendEntityInfoViaWebSocket = (
  entityType: string,
  label: string,
  color: string,
  lat: number,
  lon: number,
  groundHeight: number
) => {
  return new Promise((resolve, reject) => {
    try {
      // 直接使用浏览器原生的 WebSocket
      const ws = new WebSocket('ws://localhost:8080');

      ws.onopen = () => {
        const message = {
          entityType,
          label,
          color,
          lat,
          lon,
          groundHeight
        };
        ws.send(JSON.stringify(message));
        ws.onmessage = (event) => {
          // 可以处理服务器返回的消息
        };
        ws.close();
        resolve(null);
      };

      ws.onerror = (error) => {
        console.error('WebSocket 连接出错:', error);
        showNotification(1, 'WebSocket 连接出错', 3000);
        reject(error);
      };

      ws.onclose = () => {
        // 连接关闭处理
      };
    } catch (error) {
      console.error('创建 WebSocket 连接时出错:', error);
      showNotification(1, '创建 WebSocket 连接时出错', 3000);
      reject(error);
    }
  });
};
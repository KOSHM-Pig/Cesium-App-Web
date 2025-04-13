// main.ts
import { createApp } from 'vue'
import App from './App.vue'
import { useCesium } from './utils/cesiumUtils'
import { TAKReceiver } from './utils/TAKReceiver'

const app = createApp(App)

// 初始化Cesium
const { viewer } = useCesium()
const takReceiver = new TAKReceiver(viewer)

// 配置TAK接收端
takReceiver.connect('wss://yourtakserver.com/cot')

// 暴露到Vue实例
app.config.globalProperties.$takReceiver = takReceiver

app.mount('#app')
import * as Cesium from 'cesium';

export const mapProviders = {
  arcgis: {
    name: 'ArcGIS全球影像',
    provider: () => new Cesium.ArcGisMapServerImageryProvider({
      url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
    })
  },
  tencent: {
    name: '腾讯地图',
    provider: () => new Cesium.UrlTemplateImageryProvider({
      url: 'http://rt{s}.map.gtimg.com/realtimerender?z={z}&x={x}&y={y}',
      subdomains: '0123'
    })
  },
  // 新增本地瓦片模式
  local: {
    name: '本地瓦片地图',
    provider: () => {
      const provider = new Cesium.UrlTemplateImageryProvider({
        url: 'http://tilemap/{z}/{x}/{y}.jpg',
        minimumLevel: 0,
        maximumLevel: 9,
        tilingScheme: new Cesium.WebMercatorTilingScheme()
      });

      // 添加错误监听
      provider.errorEvent.addEventListener(err => {
        console.error('瓦片加载失败:', err);
      });

      return provider;
    }
  }
};

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vectorcontrol.app',
  appName: 'VectorControl',
  webDir: 'dist',
  plugins: {
    CapacitorUpdater: {
      // 自动更新配置
      // 可以配置自定义更新服务器，或使用 Capgo 服务
      autoUpdate: true,
      // 更新检查间隔（毫秒），默认 1 小时
      updateCheckInterval: 3600000,
      // 更新服务器 URL（可选，自托管时使用）
      // serverUrl: 'https://your-update-server.com',
    }
  },
  // Android 配置
  android: {
    // 启用混淆
    minifyEnabled: true,
  }
};

export default config;

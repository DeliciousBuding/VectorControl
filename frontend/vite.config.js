import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // 打包分析（仅分析模式启用）
    mode === 'analyze' && visualizer({ 
      open: true,
      gzipSize: true,
      brotliSize: true 
    })
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:21345',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    // 代码分割策略
    rollupOptions: {
      output: {
        manualChunks: {
          // 将大型依赖分离到独立 chunk
          'echarts-vendor': ['echarts', 'echarts-for-react'],
          'antd-vendor': ['antd', '@ant-design/icons'],
          'react-vendor': ['react', 'react-dom'],
          'utils-vendor': ['dayjs']
        },
        // 资源文件命名
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.')
          const ext = info[info.length - 1]
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(assetInfo.name)) {
            return 'assets/images/[name]-[hash][extname]'
          }
          if (/\.(woff2?|eot|ttf|otf)$/i.test(assetInfo.name)) {
            return 'assets/fonts/[name]-[hash][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        },
        // JS chunk 命名
        chunkFileNames: 'js/[name]-[hash].js',
        // 入口文件命名
        entryFileNames: 'js/[name]-[hash].js'
      }
    },
    // 压缩配置
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug']
      },
      format: {
        comments: false
      }
    },
    // 资源内联阈值（4KB以下内联）
    assetsInlineLimit: 4096,
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 源码映射（生产环境关闭）
    sourcemap: false,
    // 报告压缩后大小
    reportCompressedSize: true
  },
  // 依赖预构建优化
  optimizeDeps: {
    include: ['antd', 'echarts', 'dayjs', '@ant-design/icons'],
    exclude: []
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.js'
  }
}))

import { CapacitorUpdater } from '@capgo/capacitor-updater'
import { App } from '@capacitor/app'
import { isPlatform } from '@ionic/core'

/**
 * 自动更新管理器
 * 支持两种更新模式：
 * 1. Capgo 云服务 - 需要在 https://capgo.app 注册并配置
 * 2. 自托管更新服务器 - 需要配置自己的更新服务器
 */

class AutoUpdateManager {
  private isUpdateAvailable = false
  private latestVersion = ''

  /**
   * 初始化自动更新
   */
  async init() {
    // 只在 Android 平台启用
    if (!isPlatform('android')) {
      console.log('[AutoUpdate] Only supported on Android')
      return
    }

    try {
      // 监听更新事件
      CapacitorUpdater.addListener('updateAvailable', async (info) => {
        console.log('[AutoUpdate] Update available:', info)
        this.isUpdateAvailable = true
        this.latestVersion = info.version || ''

        // 可以在这里显示更新提示
        // this.showUpdateNotification(info)
      })

      CapacitorUpdater.addListener('updateDownloaded', async (info) => {
        console.log('[AutoUpdate] Update downloaded:', info)
        // 更新已下载，可以提示用户重启
      })

      CapacitorUpdater.addListener('error', (error) => {
        console.error('[AutoUpdate] Error:', error)
      })

      // 禁用自动下载，让用户手动确认
      await CapacitorUpdater.setAutoDownload({ autoDownload: false })

      // 检查更新
      await this.checkForUpdates()

    } catch (error) {
      console.error('[AutoUpdate] Init error:', error)
    }
  }

  /**
   * 手动检查更新
   */
  async checkForUpdates() {
    if (!isPlatform('android')) {
      return null
    }

    try {
      const result = await CapacitorUpdater.check()
      console.log('[AutoUpdate] Check result:', result)
      return result
    } catch (error) {
      console.error('[AutoUpdate] Check error:', error)
      return null
    }
  }

  /**
   * 下载并安装更新
   */
  async downloadUpdate() {
    if (!isPlatform('android')) {
      return false
    }

    try {
      await CapacitorUpdater.download()
      return true
    } catch (error) {
      console.error('[AutoUpdate] Download error:', error)
      return false
    }
  }

  /**
   * 安装更新并重启应用
   */
  async installUpdate() {
    if (!isPlatform('android')) {
      return false
    }

    try {
      await CapacitorUpdater.reload()
      return true
    } catch (error) {
      console.error('[AutoUpdate] Install error:', error)
      return false
    }
  }

  /**
   * 获取当前应用版本
   */
  async getAppVersion(): Promise<string> {
    try {
      const info = await App.getInfo()
      return info.version || '1.0.0'
    } catch {
      return '1.0.0'
    }
  }
}

export const autoUpdate = new AutoUpdateManager()

// 自动初始化
autoUpdate.init()

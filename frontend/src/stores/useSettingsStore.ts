/**
 * 系统设置状态管理 Store
 * @module stores/useSettingsStore
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { AppSettings } from '../types';

const DEFAULT_SETTINGS: AppSettings = {
  display: {
    auto_refresh_enabled: true,
    auto_refresh_seconds: 60,
    auto_refresh_visible_only: true
  },
  notifications: {
    feishu: { 
      enabled: false, 
      webhook_url: '', 
      advice_time: '14:50', 
      report_time: '15:10',
      timeout_seconds: 30,
      retry_times: 3,
      template: ''
    },
    telegram: { 
      enabled: false, 
      bot_token: '', 
      chat_id: '',
      parse_mode: 'HTML',
      disable_web_page_preview: false,
      timeout_seconds: 30,
      retry_times: 3
    },
    email: { 
      enabled: false, 
      smtp_host: '', 
      smtp_port: 587,
      sender: '',
      recipients: '',
      use_tls: true
    }
  },
  network_benchmark: {
    default_profile: 'default',
    timeout_seconds: 30,
    last_run_at: '',
    last_result: null
  }
};

function mergeDeep<T extends Record<string, unknown>>(base: T, incoming: unknown): T {
  const result = { ...base };
  if (!incoming || typeof incoming !== 'object') return result;
  
  for (const [key, value] of Object.entries(incoming as Record<string, unknown>)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && 
        result[key] && typeof result[key] === 'object') {
      result[key] = mergeDeep(result[key] as Record<string, unknown>, value);
    } else {
      result[key] = value as T[Extract<keyof T, string>];
    }
  }
  return result;
}

interface SettingsState {
  settings: AppSettings;
  ready: boolean;
}

interface SettingsActions {
  setSettings: (newSettings: AppSettings) => void;
  patchSettings: (patch: Partial<AppSettings>) => void;
  toggleAutoRefresh: () => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  immer((set) => ({
    settings: DEFAULT_SETTINGS,
    ready: false,

    setSettings: (newSettings) => set((state) => {
      state.settings = mergeDeep(DEFAULT_SETTINGS, newSettings);
      state.ready = true;
    }),

    patchSettings: (patch) => set((state) => {
      state.settings = mergeDeep(state.settings, patch);
    }),

    toggleAutoRefresh: () => set((state) => {
      state.settings.display.auto_refresh_enabled = !state.settings.display.auto_refresh_enabled;
    }),

    reset: () => set({ settings: DEFAULT_SETTINGS, ready: false })
  }))
);

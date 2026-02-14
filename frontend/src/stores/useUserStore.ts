/**
 * 用户状态管理 Store
 * @module stores/useUserStore
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { User } from '../types';

interface UserState {
  user: User | null;
  authLoading: boolean;
  authReady: boolean;
  authError: string | null;
}

interface UserActions {
  setUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;
  setAuthReady: (ready: boolean) => void;
  setAuthError: (error: string | null) => void;
  logout: () => void;
}

export const useUserStore = create<UserState & UserActions>()(
  immer((set) => ({
    // State
    user: null,
    authLoading: false,
    authReady: false,
    authError: null,

    // Actions
    setUser: (user) => set((state) => { state.user = user; }),
    setAuthLoading: (loading) => set((state) => { state.authLoading = loading; }),
    setAuthReady: (ready) => set((state) => { state.authReady = ready; }),
    setAuthError: (error) => set((state) => { state.authError = error; }),
    
    logout: () => set((state) => {
      state.user = null;
      state.authError = null;
    })
  }))
);

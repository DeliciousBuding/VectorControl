/**
 * 投资组合状态管理 Store
 * @module stores/usePortfolioStore
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { FundRow, RiskOverview, EstimateDataStatus } from '../types';

interface CoverageStats {
  total: number;
  ok: number;
  failed: number;
}

interface PortfolioState {
  rows: FundRow[];
  riskOverview: RiskOverview | null;
  asof: string;
  updatedAt: string;
  confirmState: string;
  coverage: CoverageStats;
  dataStatus: EstimateDataStatus;
  loading: boolean;
  lastRefresh: string;
  refreshElapsedMs: number;
  cacheHit: boolean;
  incrementalMode: string;
  incrementalReusedQuotes: number;
  incrementalFetchedQuotes: number;
}

interface PortfolioActions {
  setRows: (rows: FundRow[]) => void;
  setRiskOverview: (risk: RiskOverview | null) => void;
  setLoading: (loading: boolean) => void;
  updateFromPayload: (payload: Record<string, unknown>) => void;
  updateHolding: (fundId: string, updatedHolding: Partial<FundRow>) => void;
  addOrReplaceHolding: (holding: FundRow) => void;
  reset: () => void;
}

const initialState: PortfolioState = {
  rows: [],
  riskOverview: null,
  asof: '--',
  updatedAt: '--',
  confirmState: 'estimated',
  coverage: { total: 0, ok: 0, failed: 0 },
  dataStatus: {
    status: 'estimating',
    asof: '',
    note: '等待估值刷新'
  },
  loading: false,
  lastRefresh: '--',
  refreshElapsedMs: 0,
  cacheHit: false,
  incrementalMode: 'full_refresh',
  incrementalReusedQuotes: 0,
  incrementalFetchedQuotes: 0
};

export const usePortfolioStore = create<PortfolioState & PortfolioActions>()(
  immer((set) => ({
    ...initialState,

    setRows: (rows) => set((state) => { state.rows = rows; }),
    setRiskOverview: (risk) => set((state) => { state.riskOverview = risk; }),
    setLoading: (loading) => set((state) => { state.loading = loading; }),
    
    updateFromPayload: (payload) => set((state) => {
      const funds = payload.funds as FundRow[] | undefined;
      state.rows = funds || [];
      state.asof = (payload.as_of as string) || (payload.asof as string) || '--';
      state.updatedAt = (payload.updated_at as string) || '--';
      state.confirmState = (payload.confirm_state as string) || 'estimated';
      
      const coverage = payload.coverage as CoverageStats | undefined;
      state.coverage = {
        total: coverage?.total || funds?.length || 0,
        ok: coverage?.ok || 0,
        failed: coverage?.failed || 0
      };
      
      state.cacheHit = Boolean(payload.cache_hit);
      state.incrementalMode = (payload.incremental_mode as string) || 'full_refresh';
      state.incrementalReusedQuotes = (payload.incremental_reused_quotes as number) || 0;
      state.incrementalFetchedQuotes = (payload.incremental_fetched_quotes as number) || 0;
      state.dataStatus = (payload.data_status as EstimateDataStatus) || {
        status: state.confirmState === 'confirmed' ? 'confirmed' : 'estimating',
        asof: (payload.asof as string) || (payload.as_of as string) || '',
        note: '估值口径由后端返回'
      };
    }),

    updateHolding: (fundId, updatedHolding) => set((state) => {
      const index = state.rows.findIndex(r => r.fund_id === fundId);
      if (index >= 0) {
        Object.assign(state.rows[index], updatedHolding);
      }
    }),

    addOrReplaceHolding: (holding) => set((state) => {
      const index = state.rows.findIndex(r => r.fund_id === holding.fund_id);
      if (index >= 0) {
        state.rows[index] = holding;
      } else {
        state.rows.unshift(holding);
      }
    }),

    reset: () => set(() => ({ ...initialState }))
  }))
);

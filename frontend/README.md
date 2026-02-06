# Fund Watchtower Frontend

F4 delivers `/api/actions` integration for execution checkboxes while keeping the single-page layout.

## Requirements
- Node.js 18+ (includes npm).

## Local Dev
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

Vite outputs static assets to `dist/` for backend hosting.

## API Integration Notes
- Use relative paths only (e.g., `/api/estimate`, `/api/advice`, `/api/actions`).
- Token is stored in `localStorage` key `fund_watchtower_token`.
- Query fallback supported: `?token=YOUR_TOKEN`.
- Requests include `Authorization: Bearer <token>` when available.
- Manual refresh only. Errors surface in the status bar.

## UI Sections
- Top bar: title, token input, refresh button, last refresh time.
- Four-ship board: data from `/api/estimate` buckets.
- 今日指令: actions from `/api/advice`.
- 执行记录: checkboxes loaded/saved via `/api/actions`.
- 复盘预览: summary + sections from `/api/report/daily` (F5).

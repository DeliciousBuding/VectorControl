# VectorControl

VectorControl 是一个面向个人投资者的持仓决策中枢，强调“专业、冷静、理性”。

当前能力：
- 多用户登录与数据隔离（用户、持仓、快照、设置、执行记录）
- 持仓中心（国内/港股在上，美股/海外在下）
- 手动刷新与自动刷新
- 单基金详情与波形图
- 风险中枢（集中度、相关性、压力测试、重叠预警）

## 快速启动

### 1. 后端

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 21345
```

### 2. 前端

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

### 3. 访问地址

- 前端：`http://127.0.0.1:5173`
- 后端健康检查：`http://127.0.0.1:21345/api/health`

## Windows 一键启动

- 双击 `scripts\start_backend.bat`
- 双击 `scripts\start_frontend.bat`

## 鉴权说明

- 如果 `.env` 中配置了 `API_TOKEN`，可用该令牌访问接口。
- 若未配置，后端启动时会生成运行时令牌并写入 `backend/data/runtime_token.txt`。

## 开发文档

- 开发规范：`docs/开发规范.md`
- Git 工作流：`docs/Git工作流.md`
- 版本路线图：`ROADMAP.md`

## 致谢与灵感来源

本项目为独立实现，参考了以下开源项目的思路（未直接复制源码）：

- FundVal-Live: <https://github.com/Ye-Yu-Mo/FundVal-Live>
- lanZzV/fund: <https://github.com/lanZzV/fund>
- real-time-fund: <https://github.com/hzm0321/real-time-fund>
- FundCrawler: <https://github.com/Jerry1014/FundCrawler>

## 免责声明

- 本项目数据与分析仅用于学习和研究，不构成投资建议。
- 数据来自公开接口，可能存在延迟、缺失或误差。
- 使用者需自行承担投资风险。

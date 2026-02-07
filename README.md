# VectorControl

VectorControl 鏄竴涓潰鍚戜釜浜烘姇璧勮€呯殑銆屾寔浠撳喅绛栦腑鏋€嶉」鐩€? 
鐩爣涓嶆槸棰勬祴甯傚満锛岃€屾槸鎶婃姇璧勬祦绋嬪伐绋嬪寲涓猴細

`浼板€?-> 鎸囦护 -> 鎵ц -> 澶嶇洏`

椤圭洰寮鸿皟锛?- 澶氱敤鎴锋暟鎹殧绂伙紙鎸?`user_id`锛?- 鎺ュ彛濂戠害绋冲畾锛堝彧澧炲瓧娈碉紝涓嶆敼璇箟锛?- 澶辫触鍙檷绾э紙鍗曞熀閲戝け璐ヤ笉闃绘柇鍏ㄥ眬锛?- 鍙儴缃层€佸彲鍥炴粴銆佸彲楠屾敹锛圙ate-A/B/C/D锛?
## 褰撳墠鍙戝竷鐗堟湰
- `v1.0.0`锛坢ain 鍙戝竷鐗堬級

## 鏋舵瀯閫熻
- 鍓嶇锛歚React + Vite`锛屽崟椤靛伐浣滃彴锛屾牳蹇冮〉闈负棣栭〉/鑷€?浜ゆ槗/鎸佷粨/鎴戠殑銆?- 鍚庣锛歚FastAPI`锛屾寜 `router + service-like modules + storage` 鍒嗗眰銆?- 鏁版嵁搴擄細榛樿 SQLite锛堟湰鍦帮級锛岀敓浜у缓璁?PostgreSQL锛堝凡鎻愪緵 Compose 缂栨帓锛夈€?- 閰嶇疆锛歚config/*.yaml` 鐢ㄤ簬鍒濆鍖栧鍏ヤ笌澶囦唤瀵煎嚭锛屼笉浣滀负杩愯鎬佸啓鍏ョ湡婧愩€?- 閮ㄧ讲锛歚Docker Compose + Nginx + HTTPS`锛圠et鈥檚 Encrypt锛夈€?
鏇磋缁嗙粨鏋勮锛歚docs/鏋舵瀯璇存槑.md`

## 鐩綍缁撴瀯
```text
VectorControl/
鈹溾攢 backend/                     # FastAPI 鍚庣
鈹? 鈹斺攢 app/
鈹?    鈹溾攢 main.py               # 搴旂敤瑁呴厤銆佷腑闂翠欢銆佽矾鐢辨敞鍐?鈹?    鈹溾攢 api/routers/          # 鎺ュ彛璺敱灞?鈹?    鈹溾攢 storage/              # 鏁版嵁搴撹闂笌琛ㄧ粨鏋勫垵濮嬪寲
鈹?    鈹溾攢 estimator/            # 浼板€笺€佹寚鏍囧彛寰勩€佽仛鍚堥€昏緫
鈹?    鈹溾攢 risk/                 # 椋庨櫓姒傝涓庤鐩栫巼
鈹?    鈹溾攢 policy/               # 鎸囦护瑙勫垯涓庨槇鍊?鈹?    鈹溾攢 data_sources/         # 澶栭儴鏁版嵁婧愶紙瓒呮椂/鍥為€€锛?鈹?    鈹斺攢 notifier/             # 鎺ㄩ€佹墿灞曚綅
鈹溾攢 frontend/                    # React 鍓嶇
鈹? 鈹斺攢 src/
鈹?    鈹溾攢 components/           # 椤甸潰缁勪欢
鈹?    鈹溾攢 hooks/                # 閴存潈涓庝笟鍔＄姸鎬?鈹?    鈹溾攢 utils/                # 鍥捐〃銆佸彛寰勩€佹牸寮忓寲宸ュ叿
鈹?    鈹斺攢 api.js                # 鍚屽煙 /api 璇锋眰灏佽
鈹溾攢 config/                      # 鍒濆鍖栭厤缃紙鍩洪噾銆佹寔浠撱€佺瓥鐣ワ級
鈹溾攢 deploy/                      # 鐢熶骇缂栨帓锛圕ompose/Nginx/Dockerfile锛?鈹溾攢 scripts/                     # Gate 楠屾敹涓庨儴缃茶剼鏈?鈹溾攢 docs/                        # 鏋舵瀯銆佸绾︺€佽璁°€侀儴缃层€佽鑼?鈹溾攢 ROADMAP.md                   # 浠诲姟娓呭崟涓庡嬀閫夎繘搴?鈹斺攢 AGENTS.md                    # 浠撳簱绾ф墽琛岃鍒?```

## 鍚庣鏍稿績鎺ュ彛
- 閴存潈涓庣敤鎴凤細`/api/auth/register`銆乣/api/auth/login`銆乣/api/auth/me`銆乣/api/auth/logout`
- 閰嶇疆涓庢寔浠擄細`/api/config`銆乣/api/holdings`銆乣/api/holdings/import_yaml`
- 浼板€间笌椋庨櫓锛歚/api/estimate`銆乣/api/risk/overview`
- 鍐崇瓥涓庢墽琛岋細`/api/advice`銆乣/api/actions`
- 澶嶇洏锛歚/api/report/daily`
- 鍋ュ悍妫€鏌ワ細`/api/health`銆乣/api/healthz`

鎺ュ彛濂戠害璇﹁锛歚docs/鎺ュ彛濂戠害.md`

## 鏈湴寮€鍙?### 1) 鍚姩鍚庣
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 21345
```

### 2) 鍚姩鍓嶇
```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

### 3) 娴忚鍣ㄨ闂?- 鍓嶇锛歚http://127.0.0.1:5173`
- 鍚庣鍋ュ悍妫€鏌ワ細`http://127.0.0.1:21345/api/health`

## 涓€閿剼鏈笌闂ㄧ
- 鏈湴鑴氭湰锛歚scripts/start_backend.bat`銆乣scripts/start_frontend.bat`
- Gate 楠屾敹锛歚scripts/check_gate_a_full.py`銆乣scripts/check_gate_b_full.py`銆乣scripts/check_gate_c_full.py`銆乣scripts/check_gate_d.py`

閮ㄧ讲缁嗚妭瑙侊細`docs/閮ㄧ讲涓庤繍琛?md`

## 褰撳墠鍒嗘敮绛栫暐
- `dev`锛氭棩甯稿紑鍙戜笌闆嗘垚
- `main`锛氬彂甯冧笌鐢熶骇

璇︾粏瑙勮寖瑙侊細`AGENTS.md` 涓?`docs/Git宸ヤ綔娴?md`

## 鏂囨。绱㈠紩
- 鏋舵瀯璇存槑锛歚docs/鏋舵瀯璇存槑.md`
- 鏈€鏂拌繘搴︼細`docs/鏈€鏂拌繘搴?md`
- 浜у搧钃濆浘锛歚docs/浜у搧闇€姹備笌椤甸潰钃濆浘.md`
- 璁捐瑙勮寖锛歚docs/璁捐绯荤粺涓庝氦浜掕鑼?md`
- 鎺ュ彛濂戠害锛歚docs/鎺ュ彛濂戠害.md`
- 閮ㄧ讲杩愯锛歚docs/閮ㄧ讲涓庤繍琛?md`
- 寮€鍙戣鑼冿細`docs/寮€鍙戣鑼?md`
- Git 宸ヤ綔娴侊細`docs/Git宸ヤ綔娴?md`

## 鍏嶈矗澹版槑
- 鏈」鐩粎鐢ㄤ簬瀛︿範涓庡伐绋嬪疄璺碉紝涓嶆瀯鎴愭姇璧勫缓璁€?- 澶栭儴鏁版嵁婧愬彲鑳藉欢杩熴€佺己澶辨垨鍙樻洿锛岃鑷鍒ゆ柇椋庨櫓銆?
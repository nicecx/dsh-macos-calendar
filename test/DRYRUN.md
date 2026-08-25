# dsh-macos-calendar dry-run 覆盖矩阵（正向推演 + 2026-08-25 修因）

> dryrun-design skill v2。本插件是「系统服务类插件」的样板：失败模式在**真实环境行为**。

## 1. 功能规格清单

### 主流程
- calendar_add：日期解析 → 事件创建（区域无关分量赋值）→ 可选 alarm
- calendar_list / calendar_events：只读查询
- calendar_delete：按标题（+from）删除

### 输入域
- 日期：YYYY-MM-DD HH:MM；非法/缺分量/跨月跨年
- 标题/备注：AppleScript 转义（引号/反斜杠——注入）
- **alert_minutes：提前分钟语义（→ trigger interval 必须为负）** ← 2026-08-25 修因

### 状态与副作用
- 事件创建是真实副作用（Calendar.app）→ env-check --verify 建/读/清
- TCC 自动化权限（按调用者隔离：bash 被拒 ≠ dsh 插件被拒）← 新发现

## 2. 测试设计表

| 功能规格 | 技术 | 规模 | 环境 | 关键断言 | 现状 |
|---|---|---|---|---|---|
| 日期解析 | 等价类+边界 | Small | — | 合法/非法/月日时分边界 | ✅ dryrun |
| 转义 | 等价类 | Small | — | 引号/反斜杠防注入 | ✅ dryrun |
| 分量赋值 | 等价类 | Small | — | 区域无关（6 行分量）| ✅ dryrun |
| **alarm interval 符号** | 语义断言 | Small | — | alert=30 → interval:-30；负输入也取负；非法→占位 | ✅ dryrun（**修因后新增**）|
| Calendar 可达 | env 探测 | Large | TCC | 列日历名；-10004 → ⚠️+指引（非误报）| ✅ env-check |
| **真实 alarm 生效** | 真实验证 | Large | TCC+Calendar | 建事件+alarm→读回 count==1→interval<0→清理 | ✅ env-check --verify |
| 权限隔离 | 识别+指引 | Large | TCC | bash 视角 ≠ 插件视角 | ✅ env-check（标注）|

## 3. 质量检测（2026-08-25）

`node test/run-all.mjs`：单元 8/8 ✅；环境接口（只读）⚠️×2 = **TCC -10004**（bash 视角被拒——
以 calendar_list 工具为准；需在 系统设置→自动化 确认权限）。`--verify` 真实验证在权限授予后跑。

## 4. 回归实证记录

| Bug | 断言 | 实证 |
|---|---|---|
| **alarm interval 符号**（正值=事件后触发，提醒无效）| buildAlertScript(30) 含 `interval:-30` 且不含 `interval:30` | 修复前直接传正值 → 断言会失败（回归捕获）|
| 日期 ISO 解析成年份 12194（旧）| dateAssign 分量赋值 | 既有断言 |

## 5. 教训（写入 dryrun-design skill）

系统服务类插件（Calendar/Messages/系统设置）的失败模式在**真实环境行为**——
纯单元测试测不到。coverage 必须含：语义断言（方向/符号）+ 真实服务 env-check
（建/读/清）+ TCC 权限识别（-10004 指引而非误报）。

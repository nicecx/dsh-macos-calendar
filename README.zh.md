# dsh-macos-calendar

DeepSeek Harness (DSH) 宿主级插件：让 agent 获得真正的 **macOS 日历**能力 ——
通过 AppleScript（EventKit 自动化）在系统「日历」App 中创建、列出、查询与删除
事件。

与界面内日历插件（如 MAGMA27/dsh-calendar 是在 DSH Web 界面内调度 Agent 任务）
不同，本插件写入的是**真实系统日历事件** —— 会同步 iCloud，在 iPhone 及所有
设备的日历里出现。

## 工具

| 工具 | 说明 |
| --- | --- |
| `calendar_list` | 列出所有日历名（只读） |
| `calendar_add` | 创建事件：标题 / 起止时间 `YYYY-MM-DD HH:MM` / 日历 / 备注 / 提前提醒分钟 |
| `calendar_events` | 查询某日历未来 N 天事件（只读） |
| `calendar_delete` | 按标题匹配删除事件（建议传 `from` 保护旧事件） |

用法：任何 DSH 会话里直接说「帮我加个日历事件」，agent 就会调用这些工具。
工具运行在 dsh web 宿主进程内，macOS 自动化权限授权一次后，无需每次会话审批。

## 安装

```sh
dsh plugin --profile web add /path/to/dsh-macos-calendar
# 然后重启 dsh web
```

要求：Node >= 22、macOS、宿主进程的自动化权限（系统设置 → 隐私与安全性 →
自动化 → 允许 dsh 宿主控制「日历」；首次 osascript 调用会弹授权窗）。

## 给插件作者的 Cordis 4 教训

本插件消费 `ctx.tools` 时未声明依赖，导致整个 dsh web 崩溃循环 231 次：
`cannot get property "tools" without inject`。Cordis 4 要求显式声明消费的服务：

```js
export const inject = ['tools']   // 模块导出形态
apply.inject = ['tools']          // 函数属性形态（加载器读这个）
```

**两种形态都要写**，兼容加载器的两种取法。

另外：AppleScript 的 `date "字符串"` 解析依赖系统区域设置（实测 ISO 字符串被
解析成年份 12194）—— 一律用**日期分量赋值**（`set year/month/day/hours/minutes
of d to ...`），区域无关。

## License

MIT

## 开发

```sh
npm test            # 单元测试（node:test，零依赖）
```

权限与 osascript 故障诊断见 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)。

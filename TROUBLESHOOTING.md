# 故障排查

## 工具报 osascript failed

错误信息截断到 800 字符；常见原因：

| 现象 | 原因 | 处理 |
|---|---|---|
| `-1743` / `not authorized` | 自动化权限未授予 | 系统设置 → 隐私与安全性 → 自动化 → 允许宿主进程控制「日历」；首次调用会弹窗 |
| `-10004` privilege violation | 运行环境沙箱拦截 Apple Events（DSH 会话沙箱内） | 通过插件工具调用（宿主进程内，非沙箱），或给沙箱完整权限 |
| `Can't get first calendar whose name is ...` | 日历名不存在 | 先调 `calendar_list` 确认真实名称 |
| `Can't make ... into type display alarm` | 提醒语法错误（旧版本 bug） | 用 0.1.0+ 版本（`make new display alarm ... trigger interval`） |
| 事件日期变成 12194 年 | AppleScript `date "字符串"` 依赖系统区域设置 | 用 0.1.0+（日期分量赋值，区域无关） |

## 事件没出现

- 确认选择的日历在「日历」App 里是可见/已订阅状态；
- iCloud 日历同步有延迟，稍等或下拉刷新。

## 日期格式

所有时间参数必须是 `YYYY-MM-DD HH:MM`（24 小时制），例如 `2026-08-26 16:00`。
其他格式会被拒绝（parseDt 校验）。

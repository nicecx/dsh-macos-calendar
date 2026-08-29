# 用法示例

在任意 DSH 会话中直接对 agent 说（或让 agent 调用工具）：

## 创建事件

```
calendar_add title="看牙医" start="2026-08-26 10:00" end="2026-08-26 11:00" calendar="Family" notes="带医保卡" alert_minutes=30
```

## 列出日历

```
calendar_list
```

## 查询未来事件

```
calendar_events calendar="Work" days=14
```

## 删除事件（建议带 from 限定）

```
calendar_delete title="临时会议" calendar="Work" from="2026-08-24 00:00"
```

## 典型问答

- 「8 月 30 号下午 3 点加个家庭活动，提前 1 小时提醒」→
  `calendar_add title=家庭活动 start=2026-08-30 15:00 end=2026-08-30 17:00 calendar=Family alert_minutes=60`
- 「我这周有什么安排」→ `calendar_events days=7`
- 「把下周一的会删掉」→ `calendar_delete title=会议 calendar=Work from=<本周一>`

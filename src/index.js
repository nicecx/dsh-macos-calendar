/**
 * dsh-macos-calendar — macOS 日历工具插件（宿主级）。
 *
 * 通过 AppleScript 操作系统「日历」App（EventKit 自动化），给 agent 提供三个工具：
 *   - calendar_list   列出所有日历名（只读）
 *   - calendar_add    创建事件（标题/起止时间/日历/备注/提前提醒分钟）
 *   - calendar_events 查询某日历某时间范围内的事件（只读）
 *
 * 权限：需要 macOS 自动化权限（系统设置 → 隐私与安全性 → 自动化 → 允许本进程
 * 控制「日历」）。宿主进程首次调用 osascript 时系统会弹窗，允许一次即可。
 *
 * 日期格式统一为 "YYYY-MM-DD HH:MM"（24 小时制）；AppleScript 的 date 字符串
 * 解析依赖系统区域设置（实测会把 ISO 解析成年份 12194），因此本插件一律用
 * 「日期分量赋值」构造 start/end date（区域无关）。
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** 解析 "YYYY-MM-DD HH:MM"，返回 AppleScript 分量 {y,m,mon,d,h,min} 或 null。 */
function parseDt(input) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(String(input ?? '').trim())
  if (!m) return null
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]); const h = Number(m[4]); const mi = Number(m[5])
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null
  return { y, m: MONTHS[mo - 1], d, h, min: mi }
}

/** AppleScript 字符串转义。 */
function esc(s) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/** 构造 "set <var> to current date / 分量赋值" 片段。 */
function dateAssign(varName, dt) {
  return `set ${varName} to current date
set year of ${varName} to ${dt.y}
set month of ${varName} to ${dt.m}
set day of ${varName} to ${dt.d}
set hours of ${varName} to ${dt.h}
set minutes of ${varName} to ${dt.min}
set seconds of ${varName} to 0`
}

/** 运行一段 AppleScript，返回 stdout；失败抛错（带 stderr）。 */
async function runAppleScript(script) {
  try {
    const { stdout } = await execFileAsync('osascript', ['-e', script], { timeout: 30000 })
    return stdout.trim()
  } catch (err) {
    const detail = (err.stderr || err.message || String(err)).trim().slice(0, 800)
    throw new Error(`osascript failed: ${detail}`)
  }
}

/** 日历名 → AppleScript 表达式（带引号转义）。 */
function calExpr(name) {
  return name ? `first calendar whose name is "${esc(name)}"` : 'first calendar'
}

async function listCalendars() {
  const out = await runAppleScript('tell application "Calendar" to get name of every calendar')
  return out
}

async function addEvent(args) {
  const { title, start, end, calendar = '', notes = '', alert_minutes: alertMin } = args
  if (!title || !start || !end) throw new Error('title/start/end 必填')
  const sd = parseDt(start); const ed = parseDt(end)
  if (!sd) throw new Error(`start 格式应为 YYYY-MM-DD HH:MM，收到: ${start}`)
  if (!ed) throw new Error(`end 格式应为 YYYY-MM-DD HH:MM，收到: ${end}`)
  if (ed.y * 10000 + ed.m + ed.d < sd.y * 10000 + sd.m + sd.d) throw new Error('end 必须晚于 start')
  const alertScript = alertMin ? `make new display alarm at end of display alarms of newEvent with properties {trigger interval:${Number(alertMin)}}` : '-- no alert'
  const script = `tell application "Calendar"
  set targetCal to ${calExpr(calendar)}
  ${dateAssign('sd', sd)}
  ${dateAssign('ed', ed)}
  set newEvent to make new event at end of targetCal with properties {summary:"${esc(title)}", start date:sd, end date:ed}
  ${notes ? `set description of newEvent to "${esc(notes)}"` : '-- no notes'}
  ${alertScript}
  return (summary of newEvent as string) & " | " & ((start date of newEvent) as string)
end tell`
  return runAppleScript(script)
}

async function listEvents(args) {
  const { calendar = '', days = 7 } = args
  const script = `tell application "Calendar"
  set targetCal to ${calExpr(calendar)}
  set d to current date
  set e to current date
  set hours of e to 23
  set minutes of e to 59
  set seconds of e to 0
  set e to e + ${Number(days) * 86400} * days
  set es to every event of targetCal whose start date ≥ d and start date ≤ e
  set out to ""
  repeat with ev in es
    set out to out & (summary of ev as string) & " @ " & ((start date of ev) as string) & linefeed
  end repeat
  return out
end tell`
  const out = await runAppleScript(script)
  return out === '' ? '(该时间范围内无事件)' : out
}

async function deleteEvents(args) {
  const { title, calendar = '', from } = args
  if (!title) throw new Error('title 必填（按标题匹配删除，请谨慎）')
  const fromScript = from
    ? (() => {
        const f = parseDt(from)
        if (!f) throw new Error(`from 格式应为 YYYY-MM-DD HH:MM，收到: ${from}`)
        return `set fd to current date
  set year of fd to ${f.y}
  set month of fd to ${f.m}
  set day of fd to ${f.d}
  set hours of fd to ${f.h}
  set minutes of fd to ${f.min}
  set seconds of fd to 0`
      })()
    : ''
  const filter = from ? ` whose summary contains "${esc(title)}" and start date ≥ fd` : ` whose summary contains "${esc(title)}"`
  const script = `tell application "Calendar"
  set targetCal to ${calExpr(calendar)}
  ${fromScript}
  set es to every event of targetCal${filter}
  repeat with e in es
    delete e
  end repeat
  return "deleted " & (count of es)
end tell`
  return runAppleScript(script)
}

const toolDefs = [
  {
    name: 'calendar_list',
    description: 'List the names of all calendars in the macOS Calendar app (e.g. Home, Family, Work). Read-only. Use before calendar_add to pick the right calendar name.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute() {
      return `日历列表:\n${await listCalendars()}`
    },
  },
  {
    name: 'calendar_add',
    description: 'Create an event in the macOS Calendar app. Args: title (required), start and end as "YYYY-MM-DD HH:MM" (required, 24h), calendar (optional name, e.g. "Family"; defaults to the first calendar), notes (optional), alert_minutes (optional, reminder minutes before). Returns the created event summary and start time.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Event title, e.g. 看牙医' },
        start: { type: 'string', description: 'Start time, format YYYY-MM-DD HH:MM (24h)' },
        end: { type: 'string', description: 'End time, format YYYY-MM-DD HH:MM (24h)' },
        calendar: { type: 'string', description: 'Calendar name (optional)' },
        notes: { type: 'string', description: 'Event notes (optional)' },
        alert_minutes: { type: 'integer', description: 'Reminder minutes before start (optional)' },
      },
      required: ['title', 'start', 'end'],
      additionalProperties: false,
    },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute(args) {
      const out = await addEvent(args)
      return `已创建日历事件: ${out}`
    },
  },
  {
    name: 'calendar_delete',
    description: 'Delete events in the macOS Calendar app whose summary contains the given title. Args: title (required), calendar (optional name; default first calendar), from (optional "YYYY-MM-DD HH:MM", only delete events starting at or after this time — always pass from when possible to avoid deleting old events). Returns the number deleted.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title substring to match, e.g. DSH插件测试' },
        calendar: { type: 'string', description: 'Calendar name (optional; default first calendar)' },
        from: { type: 'string', description: 'Only delete events starting at/after this time, format YYYY-MM-DD HH:MM (recommended)' },
      },
      required: ['title'],
      additionalProperties: false,
    },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute(args) {
      const out = await deleteEvents(args)
      return `删除结果: ${out}`
    },
  },
  {
    name: 'calendar_events',
    description: 'List events in the macOS Calendar app for the next N days (default 7). Args: calendar (optional name), days (optional, 1-90). Read-only.',
    parameters: {
      type: 'object',
      properties: {
        calendar: { type: 'string', description: 'Calendar name (optional; default first calendar)' },
        days: { type: 'integer', description: 'Look-ahead days, default 7, max 90' },
      },
      required: [],
      additionalProperties: false,
    },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute(args) {
      const days = Math.max(1, Math.min(90, Number(args.days ?? 7)))
      return `未来 ${days} 天事件:\n${await listEvents({ ...args, days })}`
    },
  },
]

export const name = 'dsh-macos-calendar'

export function apply(ctx) {
  ctx.effect(() => {
    const disposers = toolDefs.map((def) => ctx.tools.register(def))
    return () => {
      for (const dispose of disposers) dispose()
    }
  }, 'dsh-macos-calendar: tools')
  ctx.logger?.info?.('dsh-macos-calendar loaded (calendar_list / calendar_add / calendar_events)')
}

// Cordis 4 requires every consumed service to be declared via "inject";
// without this, accessing ctx.tools throws "cannot get property tools without inject".
// Keep both forms so the include loader resolves the dependency regardless of
// whether it reads the module namespace or the apply function itself.
export const inject = ['tools']
apply.inject = ['tools']

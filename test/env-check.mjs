#!/usr/bin/env node
/**
 * dsh-macos-calendar 环境接口自检（2026-08-25 新增——旧 coverage 的盲区）。
 *
 * 教训：日历插件的关键失败模式是**真实环境行为**（AppleScript 语法、Calendar 响应、
 * alarm 是否真创建/生效）——纯单元测试测不到，必须 env-check 层真实验证。
 *
 * 检查面（默认只读，零副作用）：
 *   1. Calendar.app 可达（osascript 列日历名）
 *   2. 目标日历存在（默认 first calendar）
 *
 * 真实验证（--verify 才执行，会创建并删除一个临时事件）：
 *   3. 建事件 + alarm（interval:-30）→ 读回 display alarms 数量 == 1
 *   4. 读回 alarm 的 trigger interval 为负（提前语义生效）
 *   5. 清理（删除临时事件）
 *
 * 用法：
 *   node test/env-check.mjs            # 只读
 *   node test/env-check.mjs --verify   # 含真实创建/读回/清理
 */
import { execFileSync } from 'node:child_process'

const osa = (script) => execFileSync('osascript', ['-e', script], { encoding: 'utf8', timeout: 30000 }).trim()

let fails = 0
let warns = 0
const out = []
const note = (mark, name, extra = '') => {
  if (mark === '✗') fails += 1
  if (mark === '⚠️') warns += 1
  out.push(`${mark} ${name}${extra ? '  ' + extra : ''}`)
}

const args = process.argv.slice(2)
const doVerify = args.includes('--verify')

// ---- 1. Calendar.app 可达 ----
const tccHint = '（TCC 权限按调用者隔离：bash 被拒 ≠ dsh 插件被拒——以 calendar_list 工具为准；若工具也报错，检查 系统设置→隐私与安全性→自动化 是否允许本进程控制「日历」）'
const tccDenied = (m) => m.includes('-10004') || m.includes('privilege violation') || m.includes('not authorized') || m.includes('denied')
try {
  const names = osa('tell application "Calendar" to get name of every calendar')
  const count = names.split('\n').filter(Boolean).length
  note('✓', `Calendar.app 可达（osascript 列出 ${count} 个日历）`, count > 0 ? '' : '（0 个日历？）')
} catch (err) {
  const m = String(err.message)
  note(tccDenied(m) ? '⚠️' : '✗', 'Calendar.app 可达（bash 视角）', tccDenied(m) ? `${m.slice(0, 60)} ${tccHint}` : m.slice(0, 120))
}

// ---- 2. 目标日历存在（默认 first calendar）----
try {
  const name = osa('tell application "Calendar" to get name of first calendar')
  note('✓', `默认日历可达：${name}`)
} catch (err) {
  const m = String(err.message)
  note(tccDenied(m) ? '⚠️' : '✗', '默认日历可达', tccDenied(m) ? `${m.slice(0, 60)} ${tccHint}` : m.slice(0, 120))
}

// ---- 3-5. [--verify] 真实 alarm 生效验证 ----
if (doVerify) {
  const title = `dsh-calendar-envchk-${Date.now()}`
  const stamp = new Date(Date.now() + 3600e3) // 1 小时后
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  try {
    // 创建事件 + alarm（提前 30 分钟 = interval -30）
    osa(`tell application "Calendar"
  set targetCal to first calendar
  set newEvent to make new event at end of targetCal with properties {summary:"${title}", start date:(current date), end date:(current date + 3600 * seconds)}
  make new display alarm at end of display alarms of newEvent with properties {trigger interval:-30}
  return id of newEvent
end tell`)
    // 读回：按标题找事件 → 检查 display alarms
    const read = osa(`tell application "Calendar"
  set out to ""
  repeat with cal in calendars
    repeat with e in (every event of cal whose summary contains "${title}")
      set out to out & (count of display alarms of e) & "|"
      repeat with a in display alarms of e
        set out to out & (trigger interval of a as string) & ";"
      end repeat
    end repeat
  end repeat
  return out
end tell`)
    const parts = read.split('|').filter(Boolean)
    const alarmCount = parts.length > 0 ? Number(parts[0]) : 0
    const intervals = parts.flatMap((p) => p.split(';').filter(Boolean))
    note(alarmCount === 1 ? '✓' : '✗', '--verify: 事件 alarm 数量 == 1', `实际 ${alarmCount}`)
    const neg = intervals.every((i) => Number(i) < 0)
    note(intervals.length > 0 && neg ? '✓' : '✗', '--verify: trigger interval 为负（提前提醒）', intervals.join(',') || '（无 interval）')
  } catch (err) {
    note('✗', '--verify: 建事件+alarm 失败', String(err.message).slice(0, 200))
  } finally {
    // 清理
    try {
      const deleted = osa(`tell application "Calendar"
  set n to 0
  repeat with cal in calendars
    repeat with e in (every event of cal whose summary contains "${title}")
      delete e
      set n to n + 1
    end repeat
  end repeat
  return n
end tell`)
      note('✓', `--verify: 清理完成（删除 ${deleted} 个临时事件）`)
    } catch (err) {
      note('⚠️', '--verify: 清理失败（临时事件可能残留）', String(err.message).slice(0, 120))
    }
  }
} else {
  note('ℹ️', '未传 --verify——跳过真实创建/读回/清理（alarm 生效的真实验证需显式启用）')
}

console.log('\n=== dsh-macos-calendar · 环境接口自检快照 ===\n')
console.log(out.join('\n'))
console.log(`\n结果：${fails === 0 && warns === 0 ? '环境接口就绪 ✅' : `${fails} 项失败 ✗ + ${warns} 项待注意 ⚠️`}`)
process.exit(fails > 0 ? 1 : 0)

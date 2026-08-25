#!/usr/bin/env node
/**
 * dsh-macos-calendar 单元 dry-run（正向推演：纯函数层）。
 *
 * 2026-08-25 修因后的固化断言：
 *   1. parseDt / esc / dateAssign —— 区域无关日期构造（旧 bug：ISO 字符串解析成年份 12194）
 *   2. **buildAlertScript —— interval 符号（新修）**：alert_minutes=30 必须产出
 *      `trigger interval:-30`（负=提前；旧实现直接传正值=事件后触发，提醒无效）
 *   3. 日期边界：跨月/跨年/非法
 *
 * 真实 Calendar 行为验证见 env-check.mjs（--verify 才创建事件）。
 * 用法：node test/dryrun.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDt, esc, dateAssign, buildAlertScript } from '../src/index.js'

test('parseDt 接受 YYYY-MM-DD HH:MM 并映射英文月份', () => {
  assert.deepEqual(parseDt('2026-08-26 16:00'), { y: 2026, m: 'August', d: 26, h: 16, min: 0 })
  assert.deepEqual(parseDt('2026-01-01 00:00'), { y: 2026, m: 'January', d: 1, h: 0, min: 0 })
})

test('parseDt 拒绝非法输入', () => {
  for (const bad of ['2026-8-26 16:00', '2026-08-26', '2026-08-26 16:00:00', '26-08-2026 16:00', '2026-13-01 00:00', '2026-00-10 00:00', '2026-01-01 24:00', '2026-01-01 12:60', 'abc', '']) {
    assert.equal(parseDt(bad), null, `应拒绝: ${bad}`)
  }
})

test('esc 转义反斜杠与双引号（防注入）', () => {
  assert.equal(esc('a"b\\c'), 'a\\"b\\\\c')
  assert.equal(esc('正常标题'), '正常标题')
})

test('dateAssign 产生区域无关的分量赋值', () => {
  const s = dateAssign('sd', { y: 2026, m: 'August', d: 26, h: 16, min: 0 })
  for (const want of ['set year of sd to 2026', 'set month of sd to August', 'set day of sd to 26', 'set hours of sd to 16', 'set minutes of sd to 0', 'set seconds of sd to 0']) {
    assert.ok(s.includes(want), `缺 ${want}`)
  }
})

// ---- 2026-08-25 新增：buildAlertScript 语义（修因断言）----

test('buildAlertScript: alert_minutes=30 → trigger interval:-30（提前=负）', () => {
  const s = buildAlertScript(30)
  assert.ok(s.includes('make new display alarm'), s)
  assert.ok(s.includes('trigger interval:-30'), `应为负 interval: ${s}`)
  assert.ok(!s.includes('interval:30'), '不得是正 interval（=事件后触发，无效提醒）')
})

test('buildAlertScript: 负输入也取负（提前语义一致）', () => {
  assert.ok(buildAlertScript(-15).includes('trigger interval:-15'))
})

test('buildAlertScript: 未传/非法 → 注释占位（不生成 alarm）', () => {
  for (const v of [undefined, null, '', 'abc', 0, NaN]) {
    assert.equal(buildAlertScript(v), '-- no alert', `值 ${v}`)
  }
})

test('buildAlertScript: 浮点/字符串数字取整为负整数', () => {
  assert.ok(buildAlertScript('1440').includes('trigger interval:-1440'))
  assert.ok(buildAlertScript(30.7).includes('trigger interval:-30'))
})

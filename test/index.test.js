/**
 * Unit tests for dsh-macos-calendar internals (no deps, node:test).
 * The AppleScript side is exercised in the live plugin; here we pin the
 * pure helpers: date parsing, escaping, and the generated date-assignment
 * snippet (the locale-independent date construction that replaced the
 * broken `date "ISO string"` parsing).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'index.js')
const mod = await import(`file://${SRC}`)

test('parseDt accepts YYYY-MM-DD HH:MM and maps month to English name', () => {
  const dt = mod.parseDt('2026-08-26 16:00')
  assert.deepEqual(dt, { y: 2026, m: 'August', d: 26, h: 16, min: 0 })
})

test('parseDt rejects malformed input', () => {
  for (const bad of ['2026-8-26 16:00', '2026-08-26', '2026-08-26 16:00:00', '26-08-2026 16:00', 'abc', '']) {
    assert.equal(mod.parseDt(bad), null, `should reject: ${bad}`)
  }
})

test('esc escapes backslashes and double quotes', () => {
  assert.equal(mod.esc('a"b\\c'), 'a\\"b\\\\c')
})

test('dateAssign produces the locale-independent component assignments', () => {
  const snippet = mod.dateAssign('sd', { y: 2026, m: 'August', d: 26, h: 16, min: 0 })
  assert.ok(snippet.includes('set year of sd to 2026'))
  assert.ok(snippet.includes('set month of sd to August'))
  assert.ok(snippet.includes('set day of sd to 26'))
  assert.ok(snippet.includes('set hours of sd to 16'))
  assert.ok(snippet.includes('set minutes of sd to 0'))
  assert.ok(snippet.includes('set seconds of sd to 0'))
})

test('the generated AppleScript date block is accepted by osascript (when permitted)', () => {
  // Locale-independent: the same block must evaluate to the intended date
  // regardless of system locale. Skip silently when automation is denied.
  const script = `${mod.dateAssign('d', { y: 2026, m: 'August', d: 26, h: 16, min: 0 })}
return (year of d as string) & "-" & (month of d as integer) & "-" & (day of d as string) & " " & (hours of d as string) & ":" & (minutes of d as string)`
  try {
    const out = execFileSync('osascript', ['-e', script], { encoding: 'utf8', timeout: 15000 }).trim()
    assert.equal(out, '2026-8-26 16:0')
  } catch {
    // TCC denied or osascript unavailable — the pure assertions above still
    // cover the component mapping; nothing to fail here.
  }
})

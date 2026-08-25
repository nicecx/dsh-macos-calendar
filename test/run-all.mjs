#!/usr/bin/env node
/** dsh-macos-calendar 统一测试运行器：node test/run-all.mjs [--verify] */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const verify = process.argv.includes('--verify')
const suites = [
  ['单元（parseDt/esc/dateAssign/buildAlertScript 语义）', join(here, 'dryrun.mjs')],
  ['环境接口（Calendar 可达 + 默认日历）', join(here, 'env-check.mjs')],
]
if (verify) suites.push(['真实 alarm 生效验证（建/读/清）', join(here, 'env-check.mjs'), '--verify'])
let failed = 0
for (const [label, file, ...extra] of suites) {
  process.stdout.write(`\n=== ${label} ===\n`)
  const res = spawnSync(process.execPath, [file, ...extra], { stdio: 'inherit', cwd: here })
  if (res.status !== 0) { console.error(`❌ ${label}`); failed += 1 } else console.log(`✅ ${label} 通过`)
}
if (failed > 0) { console.error(`\n${failed} 个套件失败`); process.exit(1) }
console.log('\ndsh-macos-calendar 全部通过 ✅')

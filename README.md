# dsh-macos-calendar

A host-side plugin for DeepSeek Harness (DSH) that gives agents real
**macOS Calendar** integration: create, list, query and delete events in the
Apple Calendar app through AppleScript (EventKit automation).

Unlike in-GUI calendar plugins (e.g. MAGMA27/dsh-calendar, which schedules
Agent runs inside the DSH web UI), this plugin writes **real system calendar
events** — they sync to iCloud and appear in Calendar on all your devices.

## Tools

| Tool | Description |
| --- | --- |
| `calendar_list` | List all calendar names (read-only) |
| `calendar_add` | Create an event: title, start/end `YYYY-MM-DD HH:MM`, calendar, notes, alert_minutes |
| `calendar_events` | List events of a calendar for the next N days (read-only) |
| `calendar_delete` | Delete events whose summary contains a title (pass `from` to protect old events) |

Usage in any DSH session: just ask "add a calendar event on ..." — the agent
calls the tools directly. The tools run inside the dsh web host process, so no
per-session approval is needed once the macOS automation permission is granted.

## Install

```sh
dsh plugin --profile web add /path/to/dsh-macos-calendar
# restart dsh web
```

Requires Node >= 22, macOS, and Automation permission for the host process
(System Settings → Privacy & Security → Automation → allow the dsh host to
control Calendar). The permission prompt appears on the first osascript call.

## Notes for plugin authors (Cordis 4)

This plugin consumed `ctx.tools` and initially crashed the whole dsh web with
`cannot get property "tools" without inject` (231 crash-loop restarts). Cordis 4
requires every consumed service to be declared:

```js
export const inject = ['tools']   // module export form
apply.inject = ['tools']          // function-property form (loader reads this)
```

Keep **both** forms so the include loader resolves the dependency regardless of
which form it reads.

AppleScript date strings depend on the system locale (an ISO string was parsed
as year 12194 in testing) — always construct dates via **date components**
(`set year/month/day/hours/minutes of d to ...`), which is locale-independent.

## License

MIT

## Development

```sh
npm test            # unit tests (node:test, zero deps)
```

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for permission and osascript
failure diagnosis.

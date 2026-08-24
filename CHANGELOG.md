# Changelog

## 0.1.0 (2026-08-24)

- Initial release: `calendar_list` / `calendar_add` / `calendar_events` /
  `calendar_delete` tools for real macOS Calendar integration (AppleScript /
  EventKit automation).
- Locale-independent date handling (date components instead of AppleScript
  `date "string"` parsing, which parsed ISO input as year 12194).
- Cordis 4 `inject` contract documented in README (missing `inject: ['tools']`
  caused a 231-crash loop on first install).
- Error reporting extends to 800 chars for diagnosability.
- Public release on GitHub; `dsh-plugin` topic registered for the
  awesome-dsh-plugin directory.

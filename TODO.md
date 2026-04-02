# PScharts TODO

- [x] t001 Show installed version number on the dashboard page (e.g. in footer or header) so users can confirm what version they're running without opening chrome://extensions
- [ ] t002 Chrome Web Store submission — publish extension for true auto-update and zero-friction install (requires $5 developer account, packaging, and review submission)
- [x] t003 build.sh: version tag passed as argument creates a misnamed ZIP (pscharts-v1.0-patch.zip instead of pscharts-v1.0.1.zip) — fix to derive patch version from manifest or accept full semver as argument
- [ ] t004 Unknown match type detection — consider prompting user to manually classify unconfirmed-type matches rather than silently showing them as "unconfirmed type"

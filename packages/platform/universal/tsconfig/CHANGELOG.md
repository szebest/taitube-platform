# Changelog

## 0.2.0

- Each preset sets its own `target` and `lib`: `server.json` ES2025, `universal.json`, `client.json` and `spec.json` ES2024 with DOM. `base.json` sets neither, so a package that extends it directly must pick one.

## 0.1.0

- First release: the JSON presets listed in the exports map.

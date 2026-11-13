# Auto-Update System — Spec

Repo: `marcusdhaynes/Candlelight` · App: Candlelight · Current version (at rollout): `0.0.0`
Category: **B** — no Settings menu — prepared / dormant only, not imported or displayed anywhere.

## Flow (identical in every app)

1. The app checks `https://api.github.com/repos/marcusdhaynes/Candlelight/releases/latest`.
2. The release tag (semver `vX.Y.Z`) is compared with the app's current version.
3. If a newer version exists:
   - **Ribbon:** a thin ribbon at the **top center** of the app, very low height — just
     enough for short text like `Update available · vX.Y.Z`. It is styled **neutrally /
     theme-aware** so it does not clash with the app's own theme. The ribbon itself is
     the button: **clicking it executes the update**. The **X** on its right dismisses it
     **permanently for that version** (stored in local storage; it does not come back on
     the next launch). Full update information remains in Settings (below).
   - **Settings → Updates section:** permanently at the **very bottom of Settings**,
     showing current version, available version, **What's New** (release notes),
     a **Check for updates** button, and an **Update** button. It stays there until updated.
4. On **Update**: download, close the current version, install/swap, and reopen.
   Web apps simply refresh to the newly deployed version. APK/native builds still
   require the platform install tap (e.g. Android's install prompt).

## Release format

- Proper **GitHub Releases** — commits alone are not enough.
- Tag: semver `vX.Y.Z`; release notes become the **What's New** text.
- Attach the installable assets for the platform (web deploy / APK / desktop build).

## Future-proof rule

- If this app **already has a Settings menu**, the Updates section is implemented
  **live now**, at the bottom of Settings, and the ribbon is wired in the app root.
- If this app has **no Settings menu anywhere**, this code is present
  **prepared / dormant only** — it is not imported or displayed anywhere and makes
  **no visible UI change**. When a Settings menu is added later, the Updates section
  is implemented at the **bottom of that Settings menu** at that time (Marcus will
  ask Muse to wire it if a future Settings menu does not pick it up automatically).

## This repo

Classification: Category B. Searched `src/**` (connector `get_file_contents` listings + full source at HEAD): no Settings page, route, or menu exists. The gear in `src/components/TopNavbar.tsx` is titled "Chart Properties / Settings" and edits chart properties only; `src/components/journal/JournalGridSettingsModal.tsx` is a journal-grid layout modal. Neither is an app Settings menu.

Files: `src/updates/update-check.ts`, `src/updates/UpdateBanner.tsx`, `src/updates/UpdatesSection.tsx` — dormant, imported nowhere. Current version from `package.json`: `0.0.0`.

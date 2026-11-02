# React Windows hosts

The project retains three hosts. Electron renders the main React design in Chromium; WPF provides a minimal native alternative; WinForms/WebView2 renders the **same desktop React build** using the installed Microsoft WebView2 Runtime. The hybrid does not replace the design with native form controls or load a web server.

RC10 initializes PerMonitorV2 DPI awareness before constructing controls. Windows PowerShell 5.1 lacks the modern `Application.SetHighDpiMode` API, so the host calls the existing signed .NET Framework 4.8 user32 wrappers, with a checked thread-context fallback. No compiled interop DLL, executable modification, compatibility-registry entry or display-setting change is used. Startup fails explicitly if the required interface is absent. Acceptance asserts the actual window context and matching native DPI/browser pixel ratio. The target display measured 144 DPI with `devicePixelRatio=1.5`; physical multi-monitor transitions remain a separate untested scenario.

## Build and shortcut

On Windows x64, use installed signed Node 24 and Windows PowerShell 5.1. Run `npm run webview:sdk` explicitly once to acquire the pinned official Microsoft SDK into private `.local`. Its archive hash and DLL Authenticode signatures are verified. This downloads SDK dependencies, not a browser runtime or model. The source archive includes the pin/setup recipe, never portable runtimes or private caches.

Run `npm run webview:build`. The output includes the same compiled React files as `desktop:build`, a Node worker, a PowerShell WinForms host, three official signed SDK DLLs and their license/notices. Use the packaged `Create-Shortcut.ps1 -DataDirectory <existing-profile>` to create a shortcut. The host requires an already installed official Microsoft WebView2 Runtime; missing prerequisites produce an explicit error without downloading anything.

Closing hides to the tray. The tray offers Open, Pause and Exit. Repeated launch reuses the existing window. One profile has one writer across all hosts; exit the current host before switching variants. Keep the previous package and validated backup until promotion checks pass.

For a primary installation, `scripts/open-primary.ps1` is copied beside a private `primary-installation.json` under the project's release directory. The descriptor selects the default host and may retain explicit webview/wpf/electron variant pointers. Shortcuts use `-Variant primary`, `-Variant wpf` or `-Variant electron`; every variant retains the same explicit data directory. This launcher verifies package identity and keeps paths within this project. It does not silently fall back to another variant or override Windows protection.

## Boundaries

React receives only typed controller commands and view updates through WebView2 messages. Commands are allowlisted; operator confirmations, arbitrary shell/filesystem services and host lifecycle are not exposed. The renderer is restricted to the exact local document/origin, with network requests, frames, unapproved navigation, downloads, permissions and host objects blocked. Approved user-initiated author/reference links open through a separately validated host service.

SQLite, original revisions, atomic domain changes, raw model evidence, bounded consent/cancellation, installed Claude Code, local inference and optional metadata-only telemetry remain in the shared Node controller. Windows credentials use the existing OS-protected native vault; no credential is saved to browser storage. Profiles/cache and backups remain private. No inferred model success or creative quality is manufactured by host acceptance.

## Acceptance

`npm run test:webview` exercises the actual packaged host and a real Windows shortcut using an explicitly marked fictional profile with inference forcibly disabled. It covers the React bridge, source/review persistence, import/export, validated backup/restore, credentials, cancellation and repeated launch. Standard verify/build/standalone and Chromium checks remain required. Test the final shortcut with Smart App Control and Defender enabled; a Chromium test alone does not certify packaged Windows launch.

# SelectCheck — Build & Installation Guide (All Platforms)

This document describes how to configure the backend URL, build the desktop app in production release mode, and package installers for **macOS**, **Windows**, and **Linux**.

---

## 1. Backend URL Configuration

SelectCheck connects to the Cloudflare Edge API proxy for text checks, quota tracking, and authentication.

### Production Backend URL
```
http://localhost:8787
```

### Configured Locations:
1. **Shared Package Default**: `packages/shared/src/index.ts`
   ```typescript
   export const DEFAULT_APP_SETTINGS: AppSettings = {
     ...
     apiUrl: 'http://localhost:8787',
     ...
   };
   ```
2. **Rust Core State**: `apps/desktop/src-tauri/src/lib.rs`
   ```rust
   api_url: "http://localhost:8787".to_string(),
   ```
3. **Desktop Local Storage Migration**: `apps/desktop/src/services/tauriBridge.ts`
   Automatically upgrades any cached `localhost:8787` to the Cloudflare URL upon app startup.
4. **In-App GUI Override**: In **Settings → AI Engine → Backend Cloudflare Edge URL**, you can inspect, test latency, or change the URL at any time.

---

## 2. macOS Build & Installation (Current Target)

### Prerequisites:
- **macOS**: Sonoma 14+ or Sequoia 15+ (Apple Silicon or Intel)
- **Xcode Command Line Tools**: `xcode-select --install`
- **Node.js**: v20+ with `pnpm` (`npm install -g pnpm`)
- **Rust toolchain**: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

### Build Command:
```bash
# From workspace root
pnpm build
pnpm --filter @select-check/desktop tauri build --bundles app,dmg
```

### Generated Artifacts:
- **Installer DMG**: `apps/desktop/src-tauri/target/release/bundle/dmg/SelectCheck_0.1.0_aarch64.dmg`
- **Standalone App**: `apps/desktop/src-tauri/target/release/bundle/macos/SelectCheck.app`

### Installation Steps on macOS:
1. Double-click the generated `.dmg` file.
2. Drag **SelectCheck.app** into `/Applications`.
3. Launch **SelectCheck** from Spotlight or Applications.
4. **Grant Accessibility Permission**:
   - Go to **System Settings → Privacy & Security → Accessibility**.
   - Enable **SelectCheck** so it can read selected text and paste replacements in-place.
5. You will see the **SelectCheck icon** in the top macOS menu bar.

---

## 3. Windows Build & Installation

### Prerequisites:
- **Windows 10 / 11** (64-bit)
- **Visual Studio 2022**: with "Desktop development with C++" workload
- **WebView2**: (preinstalled on Windows 10/11)
- **Rust**: `x86_64-pc-windows-msvc`
- **Node.js & pnpm**

### Build Command:
```powershell
# From workspace root
pnpm build
pnpm --filter @select-check/desktop tauri build
```

### Generated Artifacts:
- **NSIS Setup Installer**: `apps/desktop/src-tauri/target/release/bundle/nsis/SelectCheck_0.1.0_x64-setup.exe`
- **MSI Enterprise Package**: `apps/desktop/src-tauri/target/release/bundle/msi/SelectCheck_0.1.0_x64_en-US.msi`

### Installation Steps on Windows:
1. Double-click `SelectCheck_0.1.0_x64-setup.exe`.
2. Follow the standard installation wizard.
3. SelectCheck runs in the Windows system tray notification area (near the clock).
4. Uses native Win32 `SetWindowsHookEx` and `UIAutomation` for selection detection.

---

## 4. Linux Build & Installation

### Prerequisites (Ubuntu / Debian):
```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

### Build Command:
```bash
# From workspace root
pnpm build
pnpm --filter @select-check/desktop tauri build --bundles deb,appimage
```

### Generated Artifacts:
- **Debian Package**: `apps/desktop/src-tauri/target/release/bundle/deb/select-check_0.1.0_amd64.deb`
- **Universal AppImage**: `apps/desktop/src-tauri/target/release/bundle/appimage/SelectCheck_0.1.0_amd64.AppImage`

### Installation Steps on Linux:
```bash
# Debian / Ubuntu / Mint
sudo dpkg -i apps/desktop/src-tauri/target/release/bundle/deb/select-check_0.1.0_amd64.deb

# AppImage (Any distro)
chmod +x SelectCheck_0.1.0_amd64.AppImage
./SelectCheck_0.1.0_amd64.AppImage
```

---

## 5. Summary Matrix

| Platform | Target Architectures | Output Formats | Input Detection Method |
| :--- | :--- | :--- | :--- |
| **macOS** | `aarch64` (Apple Silicon), `x86_64` (Intel) | `.app`, `.dmg` | Native `CGEventTap` (HID event stream) |
| **Windows** | `x86_64` | `.exe` (NSIS), `.msi` (WiX) | Win32 Mouse Hook + `SendInput` |
| **Linux** | `x86_64`, `aarch64` | `.deb`, `.AppImage` | X11 `XTest` / Wayland Global Hotkey |

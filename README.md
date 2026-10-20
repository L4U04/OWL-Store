# Owl Store • PlayStation 4 FPKG Hub & Manager

> A modern console interface application built with **Next.js**, designed to run natively as an packaged **`.pkg`** application on the **PlayStation 4 (Orbis OS)**, featuring full navigation via **DualShock 4 / Gamepad API** and direct communication with the **Remote Package Installer (RPI / GoldHEN)**.

---

## ✨ Key Features

- **10-Foot UI (Console Style):** Designed specifically for D-Pad, analog sticks, and action button navigation, delivering an experience identical to the official PlayStation Store.
- **Gamepad API Integration:** Real-time, full support for DualShock 4, DualSense, and USB gamepads (featuring shortcut button mapping, analog sticks, and smooth vertical scrolling with the right analog stick).
- **RPI Queue Manager (`libSceBgft`):** Sends `.pkg` files directly to the PS4's background download queue over port `12800` (equipped with client-side hybrid fallback for static environments).
- **Smart Filters & Categories:** Automatic genre classification (*Souls-like & RPG*, *Survival Horror*, *FPS*, *Action*, etc.), Title ID (CUSA) search, and size sorting.
- **Native Visual Assets:** Automated Python scripts to generate `icon0.png` (512x512) and `pic1.png` (1920x1080) in strict 24-bit RGB format (without alpha transparency), fully compliant with Sony's rigorous requirements.

---

## 🛠️ Tech Stack

- **Frontend:** Next.js (App Router), React, Tailwind CSS, Lucide Icons.
- **Backend / Proxy:** Next.js API Routes (`src/app/api/ps4/route.ts`) with HTTP HEAD validation and typed asynchronous requests (`AbortSignal`).
- **PS4 Toolchain:** OpenOrbis SDK, `PkgTool.Core`, and `create-gp4` for native Orbis packaging (`.pkg`).

---

🎮 Controller Mapping (DualShock 4)

Controller Button	Owl Store Action

D-Pad / Left Analog	Navigate through game tiles and menus

✕ (Cross / A)	Select item, open modal, or confirm PS4 installation

◯ (Circle / B)	Close modals or return to the previous tab

□ (Square / X)	Add / remove from Favorites

△ (Triangle / Y)	Focus on the instant search bar

L1 / R1	Switch between main tabs (Discover, Library, Favorites, Downloads)

L2 / R2	Switch library pages / Change featured highlights

Right Analog Stick	Smoothly scroll the page vertically

OPTIONS	Open network configuration panel (PS4 IP address)

---

⚙️ Network Configuration (RPI)

To allow the store to send games directly to your console:

  Ensure your PS4 and the store server are on the same local network.

  Press OPTIONS on your controller to open the configuration panel.

  Enter your PS4's local IP address (or 127.0.0.1 if running locally) and the RPI port (default: 12800).

📄 License

Developed for educational and homebrew management purposes within the Orbis OS ecosystem.

---

## 📁 Project Structure

  ```text
  OWL-Store
  ├── src/
  │   ├── app/
  │   │   ├── api/ps4/route.ts     # RPI / GoldHEN Proxy & Communicator (Port 12800)
  │   │   ├── globals.css          # Global styles and WebKit optimizations
  │   │   ├── layout.tsx           # Root layout with native dark mode support
  │   │   └── page.tsx             # Main Owl Store Interface (Console UI)
  │   ├── hooks/
  │   │   └── useGamepad.ts        # Gamepad API polling hook (60fps)
  │   └── data/
  │       └── games.json           # Unified PKG package database
  ├── pkg_builder/
  │   ├── build_pkg.sh             # Automated build script
  │   ├── generate_assets.py       # icon0.png & pic1.png generator (Pillow)
  │   └── main.cpp                 # WebBrowserDialog redirector (OpenOrbis)
  └── README.md

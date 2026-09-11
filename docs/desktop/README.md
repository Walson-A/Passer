# Passer Desktop App Architecture

The Passer Desktop App is the core bridge between the user's iPhone and their Windows PC. Built using **Tauri v2**, it provides a high-performance Rust backend interwoven with a sleek React frontend.

## 🏗️ Modular Structure

To maintain a clean and scalable architecture, the desktop app documentation is split into several focused areas:

- **[Backend Architecture](./backend.md)**: Details the Rust/Tauri backend, including lifecycle management, window behaviour, and system tray integration.
- **[Frontend Architecture](./frontend.md)**: Covers the React UI, Premium Glassmorphism design system, component hierarchy, and animations.
- **[API & Network Integration](./api.md)**: Documents the REST API for iOS Shortcuts, the WebDAV server for native file access, and mDNS network discovery.

## 🌍 General Philosophy
- **Local First**: Everything operates securely on the local network (no cloud dependencies).
- **Ephemeral and Fast**: The history feed is lightweight, and background processes are transparent but satisfyingly animated on the UI.
- **Unobtrusive**: Disguised as a system tray utility, the app is instantly accessible without cluttering the user's workspace.

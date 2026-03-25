# Passer Architecture & Guidelines

Passer is a seamless bridge between iPhone and PC, built with Tauri (v2) and React.

## 🏗️ Project Structure

The project is divided into two main parts:

### 1. `passer-app/` (The Desktop Application)
- **`src-tauri/`**: Rust backend (Tauri). Handles system-level operations, WebDAV server, and iOS Shortcut integration via REST API.
- **`src/`**: React frontend. Built with Vite and TailwindCSS. Features a premium glassmorphic UI that docks at the bottom-right.
- **`src/hooks/`**: Custom hooks for managing state and IPC (Inter-Process Communication) with Rust.
- **`src/components/`**: Modular React components, designed with glassmorphism in mind.

### 2. `passer-website/` (The Landing Page)
- **Vite + React**: A high-performance landing page.
- **TailwindCSS 4**: Used for modern, utility-first styling.
- **Framer Motion**: For smooth, premium animations.

## 🛠️ Development Standards

### 1. Unified Design Language
- Both the app and the website must follow the **Glassmorphism** design system defined in `docs/design_concept.md`.
- No generic colors; use the refined palette (Eerie Black, Jet, Onyx) with vibrant accents.

### 2. Documentation First
- Every new feature or architectural change MUST be documented in `docs/`.
- Ensure the `README.md` at the root remains the single source of truth for installation and quick start.

### 3. iOS Integration (Shortcuts)
- The app exposes a local REST API that iOS Shortcuts communicate with.
- Any changes to this API must be carefully tested for backward compatibility with existing Shortcuts.

### 4. Privacy & Performance
- Everything runs locally. No cloud dependencies.
- UI must remain ultra-fast and responsive, especially the docking/undocking animations.

---

## 🎨 Note to AI Agents
- Strictly follow the `AGENTS.md` rules at the root for task execution and reporting.
- Use `task_boundary` to manage complex work and provide clear `implementation_plan.md` artifacts before beginning implementation.

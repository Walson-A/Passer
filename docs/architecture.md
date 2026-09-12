# Passer Architecture & Guidelines

Passer is a seamless bridge between iPhone and PC, built with Tauri (v2) and React.

## 🏗️ Project Structure

The project is divided into three main parts:

### 1. `passer-app/` (The Desktop Application)
- **`src-tauri/`**: Rust backend (Tauri). Handles system-level operations, the local HTTP file/clipboard server, and iOS Shortcut integration via REST API.
- **`src/`**: React frontend. Built with Vite and TailwindCSS. Features a premium glassmorphic UI that docks at the bottom-right.
- **`src/hooks/`**: Custom hooks for managing state and IPC (Inter-Process Communication) with Rust.
- **`src/components/`**: Modular React components, designed with glassmorphism in mind.

### 2. `passer-website/` (The Landing Page)
- **Vite + React 19**: A high-performance landing page.
- **Path Aliases**: Uses `@/` to point to the `src/` directory for cleaner imports.
- **Modular Components**:
    - `src/components/layout/`: Global elements (Navbar, Footer).
    - `src/components/sections/`: Page sections (Hero, Features, Shortcuts).
    - `src/components/ui/`: Reusable premium animation components (Reveal, TiltCard).
- **Internationalization (i18n)**:
    - Multi-language support (EN/FR) using `react-i18next`.
    - Strict ESLint rule: `eslint-plugin-i18next` prevents any hardcoded strings in JSX.
    - All content resides in `src/locales/`.
- **Styling**: TailwindCSS 4 + Framer Motion.

### 3. `passer-mobile/` (The iPhone App)
- **Expo SDK 57 + expo-router**: React Native with strict TypeScript. Built on EAS, so no Mac is required.
- **`src/core/`**: The desktop contract (pairing link, responses, connection strategy, API client). No React Native imports, unit-tested with Jest.
- **`src/platform/`**: Thin wrappers over native modules (Keychain, file transfers, pickers, clipboard, haptics), so Android can swap implementations without touching logic.
- **`src/state/`**, **`src/components/`**, **`src/app/`**: Providers, the "Conduit" home screen pieces, and routes.
- **Details**: `docs/mobile/README.md` (architecture and decisions) and `docs/mobile/SPEC.md` (the brief).

## 🛠️ Development Standards

### 1. Unified Design Language
- Both the app and the website must follow the **Glassmorphism** design system defined in `docs/design_concept.md`.
- No generic colors; use the refined palette (Eerie Black, Jet, Onyx) with vibrant accents.

### 2. Documentation First
- Every new feature or architectural change MUST be documented in `docs/`.
- Ensure the `README.md` at the root remains the single source of truth for installation and quick start.

### 3. iOS Integration (Mobile App and Shortcuts)
- The desktop exposes a local REST API that the mobile app and the iOS Shortcuts both talk to. Its contract lives in `docs/desktop/api.md`.
- Any change to this API must stay compatible with the mobile app's parser (unknown pairing parameters are ignored; a new major `v` asks users to update) and be tested against existing Shortcuts.

### 4. Privacy & Performance
- Everything runs locally. No cloud dependencies.
- UI must remain ultra-fast and responsive, especially the docking/undocking animations.

---

## 🎨 Note to AI Agents
- Strictly follow the `AGENTS.md` rules at the root for task execution and reporting.
- Use `task_boundary` to manage complex work and provide clear `implementation_plan.md` artifacts before beginning implementation.

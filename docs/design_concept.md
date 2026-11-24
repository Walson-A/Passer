# Passer Design Concept - "Premium Glass"

Passer's visual identity is built on transparency, depth, and high-performance aesthetics. It should feel like a premium tool, similar to the polish seen in Apple's Home app or Tesla's interface.

## 1. Palette & Atmosphere

**Key Colors:**
- **Base (OLED Black):** `#000000` or `#050505`.
- **Card (Onyx/Jet):** `rgba(255, 255, 255, 0.03)` with blur.
- **Accent (Electric Blue):** For primary actions and status indicators.
- **Status (Emerald/Ruby):** For success/error feedback.

**Gradients:**
- Use subtle mesh gradients in the background to provide depth without distractions.
- Linear gradients for text masking (`from-white to-white/40`) to create a "metallic" feel.

## 2. Glassmorphism Utilities

- **Backdrop Blur:** Minimum `12px` for panels and overlays.
- **Borders:** Ultra-thin (`1px`) with low opacity (`rgba(255, 255, 255, 0.05)`).
- **Shadows:** Soft, large-radius shadows to lift interactive elements.
- **Texture:** A subtle **Noise Overlay** (0.03 opacity) is applied globally to create a tactile, high-end paper-like feel.

## 3. Typography & Motion

- **Font:** Inter or SF Pro Display (San Francisco). Focus on tight tracking (`tracking-tighter`) and semi-bold weights for headings.
- **Animations:**
    - **Crystal Reveal**: Elements transition from `blur(12px)` and `scale(1.05)` to clear state, creating a "focusing" effect.
    - **Staggered Entrance**: Hero components appear in sequence to guide user attention.
    - **3D Tilt Interaction**: Feature and Shortcut cards react to mouse position with smooth 3D tilting.
    - **Smooth Scroll Reveal**: Section-level "slide-up" animations using `framer-motion`'s `whileInView`.
    - **CTA Glow**: Primary actions have a soft, pulsing glow on hover to indicate priority.

## 4. UI Layout (App)

- The app is a full window (1180×760 by default, resizable), with a sidebar for its spaces. It started as a "docked" utility pinned by the taskbar; once Passer became a network of your devices (joining, permissions, approvals) that panel was too small, and Walson chose a real window (November 2026).
- The Devices space follows the **Showroom** direction: every device in one horizontal strip, the chosen one large on stage with only what it can really do. The mockups that led there are in `passer-app/directions.html`.
- The corner HUD still announces transfers while the window is hidden.

---

*This document serves as the aesthetic guide for all UI/UX development in Passer.*

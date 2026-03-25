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
- **Borders:** Ultra-thin (`1px`) with low opacity (`rgba(255, 255, 255, 0.08)`).
- **Shadows:** Soft, large-radius shadows to lift interactive elements.

## 3. Typography & Motion

- **Font:** Inter or SF Pro Display (San Francisco). Focus on tight tracking and semi-bold weights for headings.
- **Animations:**
    - Use "Spring" physics for most transitions (`framer-motion`).
    - Scroll-triggered reveals for the landing page.
    - Hover states should include a 3D tilt or a subtle "glow" expansion.

## 4. UI Layout (App)

- The app is a "Docked" utility.
- It stays pinned to the taskbar area by default.
- Animations between the compact "Passer Space" and full view must be seamless.

---

*This document serves as the aesthetic guide for all UI/UX development in Passer.*

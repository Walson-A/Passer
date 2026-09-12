import ReactDOM from "react-dom/client";
import { HudBanc } from "./HudBanc";
// The bench needs the app's own tokens and keyframes, so it judges the real
// thing rather than a lookalike.
import "../App.css";

/**
 * Development entry for the HUD bench — `npm run dev`, then /banc.html
 *
 * Not listed in `vite.config.ts`: dev only, no weight in the packaged app.
 */

// App.css is written for a fixed-size Tauri window - `body { overflow: hidden }`
// and `#root { height: 100vh }`. Inherited here they clip the bench to one
// screen and make it unscrollable, which hid two of its three rows. Undone
// before the first paint, the same way main.tsx neutralises them for the HUD.
document.body.style.overflow = "auto";
document.body.style.background = "#0a0a0a";
const root = document.getElementById("root")!;
root.style.height = "auto";
root.style.minHeight = "100vh";

ReactDOM.createRoot(root).render(<HudBanc />);

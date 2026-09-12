import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { Hud } from "./components/Hud";
// Imported here, not only in App.tsx: the HUD window never mounts <App />, so
// without this its window would load with no stylesheet at all.
import "./App.css";

// Both windows load index.html - tell them apart by their Tauri window label.
// (Falls back to "main" outside Tauri, e.g. a plain `npm run dev`.)
let windowLabel = "main";
try {
  windowLabel = getCurrentWindow().label;
} catch {
  /* not running inside Tauri */
}

// Done synchronously, before the first paint: on a transparent window an
// opaque default background shows as a grey flash otherwise.
if (windowLabel === "hud") {
  document.documentElement.style.background = "transparent";
  document.body.style.cssText += ";margin:0;overflow:hidden;background:transparent;";
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {/* Matched positively on "hud" rather than negatively on "not main": a rule
        written in the negative would catch every window added later. */}
    {windowLabel === "hud" ? <Hud /> : <App />}
  </React.StrictMode>,
);

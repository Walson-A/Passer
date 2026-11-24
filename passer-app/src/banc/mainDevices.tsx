import ReactDOM from "react-dom/client";
import { DevicesBanc, DevicesFrame, SCENARIOS } from "./DevicesBanc";
import "../App.css";

/**
 * Development entry for the Devices bench — `npm run dev`, then /devices-banc.html
 *
 * Two modes. Without `?s=` it is the board: every scenario side by side, each in
 * an iframe the size of the real window. With `?s=<scenario>` it is one of those
 * frames: the real Devices tab and approval card, over a fake backend. Frames are
 * iframes because each needs its own fake backend - the mocks live on `window`.
 *
 * Not listed in `vite.config.ts`: dev only, no weight in the packaged app.
 */

const params = new URLSearchParams(location.search);
const id = params.get("s");
const scenario = SCENARIOS.find(s => s.id === id);
const root = document.getElementById("root")!;

if (scenario) {
    // The frame: a transparent window over a desktop, like the real one.
    document.body.style.background = "transparent";
    ReactDOM.createRoot(root).render(<DevicesFrame scenario={scenario} />);
} else {
    // The board needs to scroll, which App.css forbids for the fixed window.
    document.body.style.overflow = "auto";
    document.body.style.background = "#0a0a0a";
    root.style.height = "auto";
    root.style.minHeight = "100vh";
    ReactDOM.createRoot(root).render(<DevicesBanc />);
}

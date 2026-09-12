import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { Layout } from "./components/Layout";
import { ServerStatusBar } from "./components/ServerStatusBar";
import { TabBar, type View } from "./components/TabBar";
import { Passboard } from "./components/Passboard";
import { PasserSpace } from "./components/PasserSpace";
import { Settings } from "./components/Settings";
import { PairDevice } from "./components/PairDevice";
import { DropZone } from "./components/DropZone";
import "./App.css";

interface LogEntry {
  message: string;
  kind: string;
}

function App() {
  const [status, setStatus] = useState<"idle" | "pushing" | "pulling" | "success" | "sync-success">("idle");
  const [isServerOn, setIsServerOn] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const [view, setView] = useState<View>("passboard");
  const [pairOpen, setPairOpen] = useState(false);

  // Switching destination always leaves the detail view, so a tab tap can never
  // land the user on a screen they cannot account for.
  const goTo = (next: View) => {
    setPairOpen(false);
    setView(next);
  };

  const toggleServer = async () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const newState = await invoke<string>("toggle_server");
      setTimeout(() => {
        setIsServerOn(newState === "on");
        setIsTransitioning(false);
      }, 500);
    } catch (e) {
      console.error("Toggle failed", e);
      setIsTransitioning(false);
    }
  };

  const handleDropSuccess = () => {
    setStatus("sync-success");
    setTimeout(() => setStatus("idle"), 400);
  };

  // Listen for backend logs
  useEffect(() => {
    let unlisten: () => void;

    async function setup() {
      unlisten = await listen<LogEntry>("log", (event) => {
        const msg = event.payload.message;
        const kind = event.payload.kind;
        console.log(`LOG [${kind}]:`, msg);

        if (msg.includes("PUSH")) {
          setStatus("pushing");
          setTimeout(() => {
            setStatus("success");
            setTimeout(() => setStatus("idle"), 700);
          }, 800);
        }
        else if (msg.includes("PULL")) {
          setStatus("pulling");
          setTimeout(() => {
            setStatus("success");
            setTimeout(() => setStatus("idle"), 700);
          }, 800);
        }
      });
    }

    setup();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  return (
    <Layout>
      <div className="flex-1 flex flex-col min-h-0">

        {/* The body. Layers stay mounted so scroll and state survive a switch. */}
        <div className="relative flex-1 min-h-0">
          <div className="view-layer" data-active={view === "passboard"}>
            {/* The server only powers /pull and /push, which is the Passboard
                flow - Space is a local folder and Settings needs nothing. So
                this is the Passboard's state, not the app's, and it belongs
                here rather than above every view. */}
            <div className="shrink-0 px-4 pt-3">
              <ServerStatusBar
                status={isServerOn ? status : "idle"}
                isReady={isServerOn}
                onClick={toggleServer}
                isTransitioning={isTransitioning}
              />
            </div>
            <Passboard />
          </div>

          <div className="view-layer" data-active={view === "space"}>
            <PasserSpace />
          </div>

          <div className="view-layer" data-active={view === "settings"}>
            <Settings
              active={view === "settings"}
              onOpenPair={() => setPairOpen(true)}
            />
          </div>

          {/* One level deeper than Settings, so it pushes in from the right. */}
          <div className="detail-layer" data-open={pairOpen}>
            <PairDevice open={pairOpen} onClose={() => setPairOpen(false)} />
          </div>
        </div>

        <TabBar view={view} onChange={goTo} />
      </div>

      <DropZone onDropSuccess={handleDropSuccess} />
    </Layout>
  );
}

export default App;

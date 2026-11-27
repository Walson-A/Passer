import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Layout } from "./components/Layout";
import { Sidebar, type View } from "./components/Sidebar";
import { Passboard, type PassboardFilter } from "./components/Passboard";
import { Settings } from "./components/Settings";
import { PairDevice } from "./components/PairDevice";
import { DropZone } from "./components/DropZone";
import { Devices } from "./components/Devices";
import { ApprovalPrompt } from "./components/ApprovalPrompt";
import { useHistory } from "./hooks/useHistory";
import type { Member } from "./components/deviceUi";
import "./App.css";

function App() {
  // Seeded from the backend on mount, never assumed. This used to start as
  // `true`, so a failed bind - port already taken - still showed as receiving.
  const [isServerOn, setIsServerOn] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Devices first: it is what Passer is about now.
  const [view, setView] = useState<View>("devices");
  const [pairOpen, setPairOpen] = useState(false);
  const [filter, setFilter] = useState<PassboardFilter>({ kind: "all" });
  // The device on the Devices stage: a drop on the window goes straight to it.
  const [stage, setStage] = useState<Member | null>(null);

  // One history for the whole app: the Passboard lists it, and each device's
  // stage shows the latest thing that came from it.
  const { history, clearHistory, deleteHistoryItem } = useHistory();

  // Switching destination always leaves the detail view, so a tap can never
  // land the user on a screen they cannot account for.
  const goTo = (next: View) => {
    setPairOpen(false);
    setView(next);
  };

  const openPassboardFor = (deviceId: string) => {
    setFilter({ kind: "device", id: deviceId });
    goTo("passboard");
  };

  const toggleServer = async () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    try {
      // The real answer arrives as server-started / server-stopped: starting
      // can still fail to bind, and the UI must not claim otherwise.
      await invoke<string>("toggle_server");
      // Safety net, in case no event ever lands.
      setTimeout(() => setIsTransitioning(false), 3000);
    } catch (e) {
      console.error("Toggle failed", e);
      setIsTransitioning(false);
    }
  };

  // Track whether the Shortcuts server is actually bound. Seeded by a command
  // because the server can bind before the webview attaches these listeners,
  // then kept current by the events the backend emits when it really starts or
  // stops.
  useEffect(() => {
    let unStarted: (() => void) | undefined;
    let unStopped: (() => void) | undefined;

    (async () => {
      try {
        setIsServerOn(await invoke<boolean>("get_server_status"));
      } catch (e) {
        console.error("Failed to read server status", e);
      }

      unStarted = await listen("server-started", () => {
        setIsServerOn(true);
        setIsTransitioning(false);
      });
      unStopped = await listen("server-stopped", () => {
        setIsServerOn(false);
        setIsTransitioning(false);
      });
    })();

    return () => {
      unStarted?.();
      unStopped?.();
    };
  }, []);

  // A device joined through an invitation of this PC: the code to compare is
  // on the Devices view, so go there. The invitation stays valid after the user
  // leaves that view, so the join can land while another view is showing.
  useEffect(() => {
    let off: (() => void) | undefined;
    let alive = true;
    (async () => {
      const un = await listen("device-joined", () => goTo("devices"));
      if (alive) off = un; else un();
    })();
    return () => { alive = false; off?.(); };
  }, []);

  return (
    <Layout>
      <Sidebar view={view} onChange={goTo} />

      {/* The body. Layers stay mounted so scroll and state survive a switch. */}
      <div className="relative flex-1 min-w-0 min-h-0">
        <div className="view-layer" data-active={view === "devices"}>
          <Devices active={view === "devices"} history={history} onOpenPassboard={openPassboardFor} onStage={setStage} />
        </div>

        <div className="view-layer" data-active={view === "passboard"}>
          <Passboard
            history={history}
            filter={filter}
            onFilter={setFilter}
            onClear={clearHistory}
            onDelete={deleteHistoryItem}
          />
        </div>

        <div className="view-layer" data-active={view === "settings"}>
          <Settings
            active={view === "settings"}
            onOpenPair={() => setPairOpen(true)}
            server={{ isReady: isServerOn, isTransitioning, onToggle: toggleServer }}
          />
        </div>

        {/* One level deeper than Settings, so it pushes in from the right. */}
        <div className="detail-layer bg-[#121212]" data-open={pairOpen}>
          <div className="flex-1 min-h-0 w-full max-w-[560px] mx-auto flex flex-col">
            <PairDevice open={pairOpen} onClose={() => setPairOpen(false)} />
          </div>
        </div>
      </div>

      {/* Files dropped on the window go to a device you choose. */}
      <DropZone target={view === "devices" ? stage : null} onOpenDevices={() => goTo("devices")} />
      {/* Above everything: another device asks for something sensitive. */}
      <ApprovalPrompt />
    </Layout>
  );
}

export default App;

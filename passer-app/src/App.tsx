import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { Layout } from "./components/Layout";
import { ServerStatusBar } from "./components/ServerStatusBar";
import { ControlFooter } from "./components/ControlFooter";
import { Passboard } from "./components/Passboard";
import { DropZone } from "./components/DropZone";
import "./App.css";

interface LogEntry {
  message: string;
  kind: string;
}

function App() {
  const [status, setStatus] = useState<"idle" | "pushing" | "pulling" | "success" | "sync-success">("idle");
  const [ip, setIp] = useState<string | null>(null);
  const [isServerOn, setIsServerOn] = useState(true);

  const handleDropSuccess = () => {
    setStatus("sync-success");
    setTimeout(() => setStatus("idle"), 2500);
  };

  // Fetch IP on mount
  useEffect(() => {
    import("@tauri-apps/api/core").then(({ invoke }) => {
      invoke<string>("get_ip").then(setIp).catch(console.error);
    });
  }, []);

  // Listen for backend logs
  useEffect(() => {
    let unlisten: () => void;

    async function setup() {
      unlisten = await listen<LogEntry>("log", (event) => {
        const msg = event.payload.message;
        const kind = event.payload.kind;
        console.log(`LOG [${kind}]:`, msg);

        // State Machine Logic
        if (msg.includes("PUSH")) {
          // Incoming from Phone
          setStatus("pushing");

          // Reset to success/idle after animation
          setTimeout(() => {
            setStatus("success");

            setTimeout(() => {
              setStatus("idle");
            }, 2000);
          }, 1500);
        }
        else if (msg.includes("PULL")) {
          // Outgoing to Phone
          setStatus("pulling");

          setTimeout(() => {
            setStatus("success");
            setTimeout(() => {
              setStatus("idle");
            }, 2000);
          }, 1500);
        }
        // Server listening notification handled by isServerOn state
      });
    }

    setup();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  return (
    <Layout>
      {/* Main Container */}
      <div className="flex-1 flex flex-col h-full min-h-0">

        {/* Server Status Bar (Passive) */}
        <ServerStatusBar
          status={isServerOn ? status : "idle"}
          isReady={isServerOn}
          ip={ip || undefined}
        />

        {/* Passboard Feed (Main Focus) */}
        <Passboard />

        {/* Footer Controls */}
        <ControlFooter isTransferring={status === 'pushing' || status === 'pulling'} />
      </div>

      <DropZone onDropSuccess={handleDropSuccess} />
    </Layout>
  );
}

export default App;

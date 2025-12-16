import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { Layout } from "./components/Layout";
import { GlassCard } from "./components/GlassCard";
import { StatusLine } from "./components/StatusLine";
import { ControlFooter } from "./components/ControlFooter";
import { HistoryWidget } from "./components/HistoryWidget";
import "./App.css";

interface LogEntry {
  message: string;
  kind: string;
}

function App() {
  const [status, setStatus] = useState<"idle" | "pushing" | "pulling" | "success">("idle");
  const [statusText, setStatusText] = useState("Ready to pair");
  const [history, setHistory] = useState<{ name: string, time: string, type: string }[]>([]);
  const [ip, setIp] = useState<string | null>(null);
  const [isServerOn, setIsServerOn] = useState(true);

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
          setStatusText("Receiving...");

          // Reset to success/idle after animation
          setTimeout(() => {
            setStatus("success");
            setStatusText(msg.includes("File") ? "Files received" : "Data received");

            // Add to history (Mock parsing)
            setHistory(prev => [{
              name: "Received Item",
              time: "Just now",
              type: msg.includes("Image") ? "IMG" : "FILE"
            }, ...prev.slice(0, 2)]);

            setTimeout(() => {
              setStatus("idle");
              setStatusText("Ready");
            }, 2000);
          }, 1500);
        }
        else if (msg.includes("PULL")) {
          // Outgoing to Phone
          setStatus("pulling");
          setStatusText("Sending to iPhone...");

          setTimeout(() => {
            setStatus("success");
            setStatusText("Sent successfully");
            setTimeout(() => {
              setStatus("idle");
              setStatusText("Ready");
            }, 2000);
          }, 1500);
        }
        else if (msg.includes("Server listening")) {
          setStatusText("Ready");
        }
      });
    }

    setup();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const toggleServer = () => {
    setIsServerOn(!isServerOn);
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center pt-8 px-6">

        {/* Main Card */}
        <GlassCard status={isServerOn ? status : "idle"} />

        {/* Status Text */}
        <StatusLine
          text={statusText}
          isReady={isServerOn}
          ip={ip || undefined}
          onToggle={toggleServer}
        />

        {/* Recent History */}
        <HistoryWidget items={history} />

        {/* Spacer */}
        <div className="flex-1"></div>

        {/* Footer Controls */}
        <ControlFooter />
      </div>
    </Layout>
  );
}

export default App;

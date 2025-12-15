import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

interface LogEntry {
  message: String;
  kind: String;
}

function App() {
  const [ip, setIp] = useState("Loading...");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  useEffect(() => {
    let unlisten: () => void;

    async function setup() {
      // Get IP
      try {
        const ipAddr = await invoke<string>("get_ip");
        setIp(ipAddr);
      } catch (e) {
        console.error(e);
        setIp("Error");
      }

      // Listen for logs
      unlisten = await listen<LogEntry>("log", (event) => {
        setLogs((prev) => [...prev, event.payload]);
      });
      console.log("Listening for logs...");
    }

    setup();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 text-slate-100 font-sans overflow-hidden select-none">
      {/* Header */}
      <div className="p-6 bg-slate-900 border-b border-slate-800 flex justify-between items-center shadow-lg z-10">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Passer
          </h1>
          <p className="text-xs text-slate-500 font-medium tracking-wider uppercase mt-1">
            LAN Clipboard Bridge
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-xs text-emerald-400 font-bold bg-emerald-400/10 px-2 py-1 rounded-full border border-emerald-400/20 shadow-[0_0_10px_rgba(52,211,153,0.2)]">
              ONLINE
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col p-6 gap-6 relative">

        {/* IP Card */}
        <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-xl p-5 flex items-center justify-between group hover:border-slate-700 transition duration-300">
          <div>
            <div className="text-slate-400 text-xs uppercase font-semibold mb-1">Server Address</div>
            <div className="text-xl font-mono text-slate-200 tracking-tight group-hover:text-white transition">
              http://<span className="text-cyan-400 font-bold">{ip}</span>:8000
            </div>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`http://${ip}:8000`);
            }}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-lg transition-all active:scale-95"
            title="Copy URL"
          >
            📋
          </button>
        </div>

        {/* Logs Console */}
        <div className="flex-1 flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
          <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 text-xs font-semibold text-slate-500 flex justify-between">
            <span>ACTIVITY LOG</span>
            <button onClick={() => setLogs([])} className="hover:text-slate-300 transition">CLEAR</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-sm scrollbar-thin scrollbar-thumb-slate-800 hover:scrollbar-thumb-slate-700">
            {logs.length === 0 && (
              <div className="text-slate-600 text-center italic mt-10 opacity-50">
                Waiting for clipboard events...
              </div>
            )}
            {logs.map((log, i) => (
              <div key={i} className="flex gap-3 animate-fade-in">
                <span className="text-slate-600 select-none">[{new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                <span className={`${log.kind === 'info' ? 'text-cyan-400' :
                    log.kind === 'error' ? 'text-red-400' : 'text-emerald-400'
                  }`}>
                  {log.kind === 'info' ? '➜' : log.kind === 'error' ? '✖' : '✔'}
                </span>
                <span className="text-slate-300 break-all">{log.message}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 text-center text-[10px] text-slate-600 border-t border-slate-900 bg-slate-950/50">
        Passer v1.0 • Tauri + Rust + React
      </div>
    </div>
  );
}

export default App;

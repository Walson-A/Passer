
import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";

export interface HistoryItem {
    id: string;
    type: 'image' | 'video' | 'text' | 'archive' | 'file';
    direction: 'incoming' | 'outgoing';
    name: string;
    description: string; // e.g., "4.2 MB" or "copied content"
    status: 'pending' | 'success' | 'error';
    timestamp: number;
    rawPath?: string; // For opening file/thumbnail
}

export function useHistory() {
    const [history, setHistory] = useState<HistoryItem[]>([]);

    const addHistoryItem = useCallback((item: HistoryItem) => {
        setHistory(prev => [item, ...prev].slice(0, 50)); // Keep last 50
    }, []);

    const updateStatus = useCallback((id: string, status: 'success' | 'error') => {
        setHistory(prev => prev.map(item =>
            item.id === id ? { ...item, status } : item
        ));
    }, []);

    useEffect(() => {
        // Listen for standard logs and attempt to parse them into history items
        // This is a "fragile" parsing approach for V1 compatibility with existing backend logs
        const unlisten = listen("log", (event: any) => {
            const { message, kind } = event.payload;
            const now = Date.now();
            const id = Math.random().toString(36).substr(2, 9);

            // PARSING LOGIC based on backend messages in clipboard.rs/files.rs

            // 1. PULL (PC -> iPhone)
            // "PULL: Sending ZIP Archive (1234 bytes)"
            // "PULL: Sending Image (1234 bytes)"
            // "PULL: Sending Text (...)"
            if (message.startsWith("PULL: Sending")) {
                let type: HistoryItem['type'] = 'file';
                let name = "Unknown";
                let description = "";

                if (message.includes("ZIP Archive")) {
                    type = 'archive';
                    name = "File Batch";
                    const size = message.match(/\((\d+) bytes\)/);
                    if (size) description = formatBytes(parseInt(size[1]));
                } else if (message.includes("Image")) {
                    type = 'image';
                    name = "Image";
                    const size = message.match(/\((\d+) bytes\)/);
                    if (size) description = formatBytes(parseInt(size[1]));
                } else if (message.includes("Text")) {
                    type = 'text';
                    name = "Clipboard Text";
                    description = "Copied to iOS";
                }

                addHistoryItem({
                    id,
                    type,
                    direction: 'outgoing',
                    name,
                    description,
                    status: kind === 'success' || kind === 'info' ? 'success' : 'error',
                    timestamp: now
                });
            }

            // 2. PUSH (iPhone -> PC)
            // "PUSH (Text) received: ..."
            // "PUSH (Image) received: 1234 bytes"
            else if (message.startsWith("PUSH")) {
                // Ignore PUSH logs that are just precursors to file saves 
                // We prefer the informatio from "Saved to" which contains the real path and filename.
                if (message.includes("(Image)") || message.includes("(File)") || message.includes("Received")) {
                    return;
                }

                let type: HistoryItem['type'] = 'file';
                let name = "Received";
                let description = "";
                let direction: HistoryItem['direction'] = 'incoming';

                if (message.includes("(Text)")) {
                    type = 'text';
                    name = "Clipboard Text";
                    const content = message.split("received: ").pop()?.replace(/\.\.\.$/, "");
                    description = content || "Copied to PC";
                }

                addHistoryItem({
                    id,
                    type,
                    direction,
                    name,
                    description,
                    status: kind === 'success' || kind === 'info' ? 'success' : 'error',
                    timestamp: now
                });
            }
            // "Saved to: C:\Users\...\Downloads\..."
            // Rust {:?} formatting adds quotes and escapes backslashes
            else if (message.includes("Saved to ")) {
                let fullPath = message.split("Saved to ").pop()?.trim() || "";

                // Strip quotes if present (Rust PathBuf {:?} formatting)
                fullPath = fullPath.replace(/^"/, "").replace(/"$/, "");

                // Normalize backslashes and forward slashes
                // convertFileSrc works best with normalized separators
                fullPath = fullPath.replace(/\\\\/g, "/").replace(/\\/g, "/");

                // Debug log to help identify path issues in the console
                console.log("[Passer] File received at:", fullPath);

                const filename = fullPath.split('/').pop() || "File";
                const ext = filename.split('.').pop()?.toLowerCase();

                let type: HistoryItem['type'] = 'file';
                const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'heic', 'gif', 'bmp'];
                if (imageExts.includes(ext || '')) type = 'image';
                else if (['mp4', 'mov', 'avi', 'mkv'].includes(ext || '')) type = 'video';
                else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) type = 'archive';

                addHistoryItem({
                    id,
                    type,
                    direction: 'incoming',
                    name: filename,
                    description: "Saved to Downloads",
                    status: 'success',
                    timestamp: now,
                    rawPath: fullPath
                });
            }

        });

        return () => {
            unlisten.then(f => f());
        };
    }, [addHistoryItem]);

    const clearHistory = useCallback(() => {
        setHistory([]);
    }, []);

    return { history, clearHistory };
}

function formatBytes(bytes: number, decimals = 1) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

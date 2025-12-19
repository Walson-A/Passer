
import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";

export interface HistoryItem {
    id: string;
    type: 'image' | 'video' | 'text' | 'archive' | 'file';
    direction: 'incoming' | 'outgoing';
    target: 'clipboard' | 'folder';
    name: string;
    fileSize?: string; // e.g., "4.2 MB" for images/files only
    status: 'pending' | 'success' | 'error';
    timestamp: number;
    rawPath?: string; // For opening file/thumbnail
}

const normalizePath = (path: string) => {
    return path
        .replace(/^"/, "")
        .replace(/"$/, "")
        .replace(/\\\\/g, "/")
        .replace(/\\/g, "/")
        .trim();
};

export function useHistory() {
    const [history, setHistory] = useState<HistoryItem[]>([]);

    const addHistoryItem = useCallback((item: HistoryItem) => {
        setHistory(prev => [item, ...prev].slice(0, 50)); // Keep last 50
    }, []);

    const clearHistory = useCallback(() => {
        setHistory([]);
    }, []);

    const deleteHistoryItem = useCallback(async (id: string) => {
        // Find the item to check if it has a cache file
        const item = history.find(h => h.id === id);

        if (item?.rawPath && item.rawPath.includes('.cache')) {
            // Delete the cache file
            try {
                const { invoke } = await import('@tauri-apps/api/core');
                await invoke('delete_cache_file', { filePath: item.rawPath });
            } catch (e) {
                console.error('Failed to delete cache file:', e);
            }
        }

        // Remove from history
        setHistory(prev => prev.filter(h => h.id !== id));
    }, [history]);

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
                let fileSize: string | undefined = undefined;

                if (message.includes("ZIP Archive")) {
                    type = 'archive';
                    name = "File Batch";
                    const sizeMatch = message.match(/\((\d+) bytes\)/);
                    if (sizeMatch) fileSize = formatBytes(parseInt(sizeMatch[1]));
                } else if (message.includes("Image")) {
                    type = 'image';
                    name = "Image";
                    const sizeMatch = message.match(/\((\d+) bytes\)/);
                    if (sizeMatch) fileSize = formatBytes(parseInt(sizeMatch[1]));
                } else if (message.includes("Text")) {
                    type = 'text';
                    name = "Clipboard Content";
                }

                addHistoryItem({
                    id,
                    type,
                    direction: 'outgoing',
                    target: type === 'text' ? 'clipboard' : 'folder',
                    name,
                    fileSize,
                    status: kind === 'success' || kind === 'info' ? 'success' : 'error',
                    timestamp: now
                });
            }

            // 2. PUSH (iPhone -> PC)
            // "PUSH (Text) received: ..."
            // "PUSH (Image) received: 1234 bytes"
            else if (message.startsWith("PUSH")) {
                let type: HistoryItem['type'] = 'text';
                let name = "Clipboard Content";
                let fileSize: string | undefined = undefined;
                let rawPath: string | undefined = undefined;

                if (message.includes("(Text)")) {
                    const content = message.split("received: ").pop()?.trim() || "";
                    if (!content) return; // Skip empty text
                    name = content;
                } else if (message.includes("(Image)")) {
                    type = 'image';
                    name = "";
                    fileSize = undefined;
                    // Extract cache path
                    const cacheMatch = message.match(/Cache: "([^"]+)"/);
                    if (cacheMatch) rawPath = normalizePath(cacheMatch[1]);
                } else {
                    // Ignore precursor logs like "PUSH: Received X files"
                    return;
                }

                addHistoryItem({
                    id,
                    type,
                    direction: 'incoming',
                    target: 'clipboard',
                    name,
                    fileSize,
                    rawPath,
                    status: kind === 'success' || kind === 'info' ? 'success' : 'error',
                    timestamp: now
                });
            }
            // "Saved to: C:\Users\...\Downloads\... (1234 bytes)"
            else if (message.includes("Saved to ")) {
                // Regex to extract path inside quotes and size: Saved to "C:\..." (1234 bytes)
                const pathMatch = message.match(/Saved to "([^"]+)"/);
                let fullPath = pathMatch ? pathMatch[1] : message.split("Saved to ")[1]?.split(' (')[0]?.trim() || "";

                // Extract file size if present
                const sizeMatch = message.match(/\((\d+) bytes\)/);
                let fileSize: string | undefined = undefined;
                if (sizeMatch) fileSize = formatBytes(parseInt(sizeMatch[1]));

                fullPath = normalizePath(fullPath);

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
                    target: 'folder',
                    name: filename,
                    fileSize,
                    rawPath: fullPath,
                    status: 'success',
                    timestamp: now,
                });
            }

        });

        return () => {
            unlisten.then(f => f());
        };
    }, [addHistoryItem]);

    return { history, clearHistory, deleteHistoryItem };
}

function formatBytes(bytes: number, decimals = 1) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

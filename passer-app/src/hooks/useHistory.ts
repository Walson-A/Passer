
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

// Coarse type sent by the backend, refined below.
interface TransferPayload {
    kind: 'text' | 'image' | 'file';
    direction: 'incoming' | 'outgoing';
    target: 'clipboard' | 'folder';
    name?: string | null;
    path?: string | null;
    size?: number | null;
}

const genId = () => Math.random().toString(36).slice(2, 11);

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
        // Consume structured transfer events emitted by the Rust backend. This
        // replaces the previous, fragile approach of regex-parsing log strings.
        const unlisten = listen<TransferPayload>("transfer", (event) => {
            const p = event.payload;

            // Refine the coarse backend kind into a specific UI type via the extension.
            let type: HistoryItem['type'] =
                p.kind === 'text' ? 'text' : p.kind === 'image' ? 'image' : 'file';

            if (type === 'file' && p.name) {
                const ext = p.name.split('.').pop()?.toLowerCase() || '';
                if (['png', 'jpg', 'jpeg', 'webp', 'heic', 'gif', 'bmp'].includes(ext)) type = 'image';
                else if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) type = 'video';
                else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) type = 'archive';
            }

            addHistoryItem({
                id: genId(),
                type,
                direction: p.direction,
                target: p.target,
                name: p.name ?? (type === 'image' ? '' : 'File'),
                fileSize: p.size != null ? formatBytes(p.size) : undefined,
                rawPath: p.path ?? undefined,
                status: 'success',
                timestamp: Date.now(),
            });
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

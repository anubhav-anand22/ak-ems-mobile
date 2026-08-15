import { create } from "zustand";
import { logger, fileAsyncTransport } from "react-native-logs";
import * as FileSystem from "expo-file-system/legacy";

export interface LogEntry {
  id: string;
  msg: string;
  level: string;
  timestamp: Date;
}

interface LogState {
  logs: LogEntry[];
  addLog: (log: Omit<LogEntry, "id">) => void;
  clearLogs: () => void;
}

const MAX_LOGS = 100;

export const useLogStore = create<LogState>((set) => ({
  logs: [],
  addLog: (log) =>
    set((state) => {
      const newLogs = [
        ...state.logs,
        { ...log, id: Math.random().toString(36).substring(7) },
      ];

      if (newLogs.length > MAX_LOGS) {
        return { logs: newLogs.slice(newLogs.length - MAX_LOGS) };
      }
      return { logs: newLogs };
    }),
  clearLogs: () => set({ logs: [] }),
}));

const zustandTransport = (props: any) => {
  if (!props) return false;

  useLogStore.getState().addLog({
    msg: props.msg,
    level: props.level.text,
    timestamp: new Date(),
  });

  return true;
};

const today = new Date().toISOString().split("T")[0];

export const log = logger.createLogger({
  transport: [fileAsyncTransport, zustandTransport],
  transportOptions: {
    FS: FileSystem,
    fileName: `app_logs_${today}.txt`,
  },
});

export const cleanupOldLogs = async () => {
  try {
    const dir = FileSystem.documentDirectory;
    if (!dir) return;

    const files = await FileSystem.readDirectoryAsync(dir);
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const fileName of files) {
      if (fileName.startsWith("app_logs_")) {
        const fileUri = dir + fileName;
        const fileInfo = await FileSystem.getInfoAsync(fileUri);

        if (fileInfo.exists && fileInfo.modificationTime) {
          const fileAgeMs = now - fileInfo.modificationTime * 1000;

          if (fileAgeMs > ONE_WEEK_MS) {
            await FileSystem.deleteAsync(fileUri, { idempotent: true });
            console.log(`[Cleanup] Deleted old log file: ${fileName}`);
          }
        }
      }
    }
  } catch (error) {
    console.error("[Cleanup] Failed to cleanup old logs:", error);
  }
};

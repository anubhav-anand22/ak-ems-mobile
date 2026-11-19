import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { PDF_WORKER_HTML } from "./pdfWorkerHtml";
import { reconstructStructure } from "./reconstructStructure";
import { ParsedPdfResult, RawPdfPage } from "./types";
import { log } from "@/lib/log";

export interface OffscreenPdfParserRef {
  parseBase64: (base64: string, timeoutMs?: number) => Promise<ParsedPdfResult>;
  isReady: () => boolean;
}

export interface OffscreenPdfParserProps {
  onReady?: () => void;
  onError?: (err: Error) => void;
}

interface PendingRequest {
  resolve: (result: ParsedPdfResult) => void;
  reject: (err: any) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

const OFFSCREEN_STYLE: ViewStyle = {
  position: "absolute",
  left: -9999,
  top: -9999,
  width: 1,
  height: 1,
  opacity: 0,
  pointerEvents: "none",
};

export const OffscreenPdfParser = forwardRef<
  OffscreenPdfParserRef,
  OffscreenPdfParserProps
>(function OffscreenPdfParser({ onReady, onError }, ref) {
  const webViewRef = useRef<WebView | null>(null);
  const [ready, setReady] = useState(false);
  const pendingRequestsRef = useRef<Map<string, PendingRequest>>(new Map());

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const raw = event.nativeEvent.data;
        if (!raw) return;

        const data = JSON.parse(raw);

        if (data.type === "READY") {
          setReady(true);
          onReady?.();
          return;
        }

        if (data.type === "PARSE_SUCCESS" && data.requestId) {
          const pending = pendingRequestsRef.current.get(data.requestId);
          if (pending) {
            clearTimeout(pending.timeoutId);
            pendingRequestsRef.current.delete(data.requestId);

            // Reconstruct structured tables, multi-line cells, and text blocks
            const structuredResult = reconstructStructure(
              data.pages as RawPdfPage[],
              data.metadata,
            );
            pending.resolve(structuredResult);
          }
          return;
        }

        if (data.type === "PARSE_ERROR" && data.requestId) {
          const pending = pendingRequestsRef.current.get(data.requestId);
          if (pending) {
            clearTimeout(pending.timeoutId);
            pendingRequestsRef.current.delete(data.requestId);
            log.error("PDF Parsing error from WebView:", data.error);
            // Strict fallback to {} on error without crashing
            pending.resolve({});
          }
          return;
        }
      } catch (err: any) {
        log.error("Failed to parse WebView message:", err);
      }
    },
    [onReady],
  );

  const parseBase64 = useCallback(
    (base64: string, timeoutMs: number = 25000): Promise<ParsedPdfResult> => {
      return new Promise<ParsedPdfResult>((resolve, reject) => {
        if (!base64 || typeof base64 !== "string" || base64.trim().length === 0) {
          return resolve({});
        }

        const requestId = `pdf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

        const timeoutId = setTimeout(() => {
          if (pendingRequestsRef.current.has(requestId)) {
            pendingRequestsRef.current.delete(requestId);
            log.error(`PDF parse request ${requestId} timed out after ${timeoutMs}ms`);
            // Strict fallback to {} on timeout
            resolve({});
          }
        }, timeoutMs);

        pendingRequestsRef.current.set(requestId, {
          resolve,
          reject,
          timeoutId,
        });

        const payload = JSON.stringify({
          type: "PARSE_PDF",
          requestId,
          base64: base64.trim(),
        });

        try {
          if (webViewRef.current) {
            webViewRef.current.postMessage(payload);
          } else {
            clearTimeout(timeoutId);
            pendingRequestsRef.current.delete(requestId);
            resolve({});
          }
        } catch (postError) {
          log.error("Failed to postMessage to WebView:", postError);
          clearTimeout(timeoutId);
          pendingRequestsRef.current.delete(requestId);
          resolve({});
        }
      });
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      parseBase64,
      isReady: () => ready,
    }),
    [parseBase64, ready],
  );

  return (
    <View style={OFFSCREEN_STYLE} pointerEvents="none">
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html: PDF_WORKER_HTML }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        mixedContentMode="always"
        onMessage={handleMessage}
        onLoadEnd={() => {
          setReady(true);
        }}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          log.error("WebView error:", nativeEvent);
          onError?.(new Error(nativeEvent.description || "WebView loading error"));
        }}
        style={styles.hiddenWebView}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  hiddenWebView: {
    width: 1,
    height: 1,
    opacity: 0,
  },
});

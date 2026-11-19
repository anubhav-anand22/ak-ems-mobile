import React, { useCallback, useMemo, useRef, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import RNFS from "react-native-fs";
import {
  OffscreenPdfParser,
  OffscreenPdfParserRef,
} from "./OffscreenPdfParser";
import { ParsedPdfResult, PDFParsedData } from "./types";
import { parseInvoiceData } from "./brandParsers";
import { log } from "@/lib/log";

export interface PickAndParsePdfResult {
  fileUri?: string;
  fileName?: string;
  fileSize?: number;
  result: ParsedPdfResult;
  invoiceData: PDFParsedData;
}

export function usePdfParser() {
  const parserRef = useRef<OffscreenPdfParserRef | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [progressText, setProgressText] = useState("");

  const readFileAsBase64 = useCallback(async (uri: string): Promise<string> => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (base64) return base64;
    } catch (e1) {
      try {
        const cleanPath = uri.startsWith("file://")
          ? uri.replace("file://", "")
          : uri;
        return await RNFS.readFile(cleanPath, "base64");
      } catch (e2) {
        log.error("Failed to read file as base64:", e1, e2);
        throw e2;
      }
    }
    return "";
  }, []);

  const parsePdfBase64 = useCallback(
    async (base64: string, timeoutMs?: number): Promise<ParsedPdfResult> => {
      if (!parserRef.current) {
        log.error("OffscreenPdfParser ref is not mounted yet");
        return {};
      }

      setIsParsing(true);
      setProgressText("Parsing PDF via off-screen WebView...");

      try {
        const result = await parserRef.current.parseBase64(base64, timeoutMs);
        return result || {};
      } catch (err) {
        log.error("usePdfParser parsePdfBase64 error:", err);
        return {};
      } finally {
        setIsParsing(false);
        setProgressText("");
      }
    },
    [],
  );

  const parsePdfFile = useCallback(
    async (uri: string, timeoutMs?: number): Promise<ParsedPdfResult> => {
      if (!uri) return {};

      setIsParsing(true);
      setProgressText("Reading PDF file as Base64...");

      try {
        const base64 = await readFileAsBase64(uri);
        if (!base64) return {};

        setProgressText("Extracting text and tables...");
        const result = await parsePdfBase64(base64, timeoutMs);
        return result;
      } catch (err) {
        log.error("usePdfParser parsePdfFile error:", err);
        return {};
      } finally {
        setIsParsing(false);
        setProgressText("");
      }
    },
    [readFileAsBase64, parsePdfBase64],
  );

  const pickAndParsePdf = useCallback(
    async (timeoutMs?: number): Promise<PickAndParsePdfResult> => {
      try {
        setProgressText("Selecting PDF document...");
        const docResult = await DocumentPicker.getDocumentAsync({
          type: "application/pdf",
          copyToCacheDirectory: true,
          multiple: false,
        });

        if (docResult.canceled || !docResult.assets?.[0]?.uri) {
          setProgressText("");
          return {
            result: {},
            invoiceData: {
              invoiceFrom: "",
              invoiceNumber: "",
              invoiceDate: Date.now(),
              totalAmount: 0,
              finalTotalAmount: 0,
              items: [],
            },
          };
        }

        const asset = docResult.assets[0];
        const result = await parsePdfFile(asset.uri, timeoutMs);
        const invoiceData = parseInvoiceData(result);

        return {
          fileUri: asset.uri,
          fileName: asset.name,
          fileSize: asset.size,
          result: result || {},
          invoiceData,
        };
      } catch (err) {
        log.error("usePdfParser pickAndParsePdf error:", err);
        return {
          result: {},
          invoiceData: {
            invoiceFrom: "",
            invoiceNumber: "",
            invoiceDate: Date.now(),
            totalAmount: 0,
            finalTotalAmount: 0,
            items: [],
          },
        };
      } finally {
        setIsParsing(false);
        setProgressText("");
      }
    },
    [parsePdfFile],
  );

  const parserElement = useMemo(
    () => (
      <OffscreenPdfParser
        ref={parserRef}
        onReady={() => setIsReady(true)}
        onError={(err) => log.error("OffscreenPdfParser encountered an error:", err)}
      />
    ),
    [],
  );

  return {
    isReady,
    isParsing,
    progressText,
    parsePdfBase64,
    parsePdfFile,
    pickAndParsePdf,
    parserElement,
    parseInvoiceData,
  };
}

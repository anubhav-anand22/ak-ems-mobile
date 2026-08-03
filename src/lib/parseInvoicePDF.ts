import {
  RecognizedTextElement,
  recognizeText,
} from "@dariyd/react-native-text-recognition";
import {
  downloadModel,
  getModelPath,
  isModelDownloaded,
  llama,
} from "@react-native-ai/llama";
import { generateText } from "ai";
import * as DocumentPicker from "expo-document-picker";
import { isAvailable } from "expo-pdf-text-extract";
import { getRandomStr } from "./getRandomStr";
import { useGlobalState } from "./gState";
import { typedKVStore } from "./typedKVStore";
import { customConfirm } from "./customConfirm";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const KVStoreKeyVals = {
  PARSE_MODE: {
    key: "PARSE_MODE",
    vals: ["API_GROK", "OFFLINE"],
  },
  GROK_API_KEY: {
    key: "GROK_API_KEY",
    vals: [],
  },
} as const;

type ParsedData = {
  providerName?: string;
  discount?: number;
  invoiceTotal?: number;
  fees?: number;
  items?: {
    productName?: string;
    quantity?: number;
    quantityType?: string;
    amount?: number;
  }[];
};

type MsgCB = (msg: string) => void;
type ProgressCB = (
  progress: number,
  intermediate: boolean,
  isComplete: boolean,
) => void;

export const parseInvoicePDF = async (
  msgCB: MsgCB,
  progressCB: ProgressCB,
  invoicePDFPath?: string,
): Promise<void | ParsedData | null> => {
  const parseModeKVStore = typedKVStore<
    (typeof KVStoreKeyVals.PARSE_MODE.vals)[number]
  >(KVStoreKeyVals.PARSE_MODE.key, KVStoreKeyVals.PARSE_MODE.vals[0]);
  let parseMode = await parseModeKVStore.get();
  if (parseMode === null) {
    const result = await customConfirm({
      id: getRandomStr(),
      title: "Parsing mode",
      body: "Which parsing mode do you want to use, online ai(Fast) or offline ai(Slow, depends on system)?",
      cancelTxt: "OFFLINE",
      confirmTxt: "ONLINE",
    });
    if (!result) return null;
    parseMode = result ? "API_GROK" : "OFFLINE";
    if (parseMode) await parseModeKVStore.set(parseMode);
  }

  const cleanLines = await getTxtArrFromPdf(invoicePDFPath);

  if (!cleanLines) return console.error("no clean lines");

  if (parseMode === "OFFLINE") {
    msgCB("parsing offline...");
    return parseInvoicePDFLocal(cleanLines, msgCB, progressCB) || null;
  } else if (parseMode === "API_GROK") {
    msgCB("parsing online...");
    return parseInvoiceWithGroqFetch(cleanLines.join("\n"), msgCB) || null;
  }

  progressCB(100, false, true);

  // const output = parseInvoiceWithGroqFetch(cleanLines.join("\n"));

  // console.log({ output });
};

export const getTxtArrFromPdf = async (invoicePDFPath?: string) => {
  if (!isAvailable())
    return useGlobalState.getState().setSnackbar({
      message: "PDF parsing is not supported by your device",
      type: "warning",
      action: "dismiss",
    });

  let pdfFilePath: string;

  if (invoicePDFPath) {
    pdfFilePath = invoicePDFPath;
  } else {
    const pdfDocPickResult = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: false,
    });

    if (pdfDocPickResult.canceled) return;

    pdfFilePath = pdfDocPickResult.assets[0].uri;
  }

  console.log(pdfFilePath);

  const result = await recognizeText(pdfFilePath, {
    recognitionLevel: "line", // Best for tabular invoices
  });

  if (result === undefined || result.pages === undefined)
    return useGlobalState.getState().setSnackbar({
      message: "Unalbe to scan PDF",
      type: "error",
      action: "dismiss",
    });

  let allElements: RecognizedTextElement[] = [];
  result.pages.forEach((page) => {
    if (page.elements) {
      allElements = allElements.concat(page.elements);
    }
  });

  if (allElements.length === 0) return;

  // DEBUG: Let's see what the Android bridge is ACTUALLY giving us at runtime
  console.log(
    "RUNTIME BOUNDING BOX:",
    JSON.stringify(allElements[0].boundingBox),
  );

  // 1. Prioritize absolute pixels. If they don't exist, multiply the normalized percentage by 1000 so the math still works.
  const getY = (box: any) => {
    if (box?.absoluteBox?.y !== undefined) return box.absoluteBox.y;
    return (box?.y ?? 0) * 1000;
  };

  const getX = (box: any) => {
    if (box?.absoluteBox?.x !== undefined) return box.absoluteBox.x;
    return (box?.x ?? 0) * 1000;
  };

  // 2. Sort from top to bottom
  allElements.sort((a, b) => getY(a.boundingBox) - getY(b.boundingBox));

  const cleanLines: string[] = [];
  let currentLineElements: RecognizedTextElement[] = [];
  let currentY = -1;

  // 3. Lowered tolerance to 8 pixels (since your text height is ~5px)
  const Y_TOLERANCE = 8;

  allElements.forEach((el) => {
    const elY = getY(el.boundingBox);

    // If this element is on roughly the same horizontal level
    if (currentY === -1 || Math.abs(elY - currentY) <= Y_TOLERANCE) {
      currentLineElements.push(el);
      if (currentY === -1) currentY = elY;
    } else {
      // We moved down! Sort the finished line left-to-right
      currentLineElements.sort(
        (a, b) => getX(a.boundingBox) - getX(b.boundingBox),
      );
      cleanLines.push(currentLineElements.map((item) => item.text).join(" "));

      // Start the next line
      currentLineElements = [el];
      currentY = elY;
    }
  });

  // Push the very last line
  if (currentLineElements.length > 0) {
    currentLineElements.sort(
      (a, b) => getX(a.boundingBox) - getX(b.boundingBox),
    );
    cleanLines.push(currentLineElements.map((item) => item.text).join(" "));
  }

  console.log(cleanLines);

  return cleanLines;
};

async function parseInvoiceWithGroqFetch(
  invoiceText: string,
  msgCB: MsgCB,
): Promise<ParsedData | null> {
  // WARNING: Move this to a backend server before releasing to production
  const apiKeyKVStore = await AsyncStorage.getItem(
    KVStoreKeyVals.GROK_API_KEY.key,
  );
  const apiKey = apiKeyKVStore?.trim();
  if (!apiKey) {
    msgCB("No API key found");
    return null;
  }
  const endpoint = "https://api.groq.com/openai/v1/chat/completions";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // model: "llama-3.1-8b-instant", // Assuming your Grok model endpoint
        model: "llama-3.3-70b-versatile",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a strict data extraction bot.
    RULES:
    1. Output ONLY valid JSON.
    2. MINIFIED format only. NO spaces, NO line breaks.
    3. Use exactly these keys: {"p":"providerName","v":invoiceTotal,"f":fees,"d":deductions,"items":[{"n":"name","q":qty,"t":"unit","a":taxInclusiveAmount}]}
    4. "a" MUST be the final item total INCLUSIVE of all taxes (CGST, SGST, Cess) and item-level discounts (e.g., use the "Total Amt" column, NEVER the "Taxable Amt").
    5. "v" is the final overall Invoice Total.
    6. "f" represents overall extra charges like Handling or Delivery fees. (Use 0 if none).
    7. "d" represents bill-level deductions like Wallet Debits. (Use 0 if none).
    8. MATHEMATICAL CHECK: The sum of all item amounts ("a") PLUS fees ("f") MINUS deductions ("d") MUST equal the invoice total ("v").
    9. DO NOT add extra keys.`,
          },
          {
            role: "user",
            content: `Extract ALL items:\n${invoiceText}`,
          },
        ],
      }),
    });
    // const response = await fetch(endpoint, {
    //   method: "POST",
    //   headers: {
    //     Authorization: `Bearer ${apiKey}`,
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({
    //     model: "llama-3.1-8b-instant",
    //     temperature: 0,
    //     max_tokens: 1536,
    //     response_format: { type: "json_object" },
    //     messages: [
    //       {
    //         role: "system",
    //         content: `You are a strict data extraction bot.
    // RULES:
    // 1. Output ONLY valid JSON.
    // 2. MINIFIED format only. NO spaces, NO line breaks.
    // 3. Use exactly these keys: {"p":"providerName","d":deductionAmount,"items":[{"n":"name","q":qty,"t":"unit","a":amount}]}
    // 4. "d" MUST dynamically capture any overall order-level deductions (e.g., "Wallet Debit", "Credits Applied", "Promo Code").
    // 5. Do NOT include item-level discounts in "d" (if the discount is applied to specific items, set "d" to 0). Set "d" to 0 if there are no order-level deductions.
    // 6. DO NOT add extra keys.`,
    //       },
    //       {
    //         role: "user",
    //         content: `Extract ALL items:\n${invoiceText}`,
    //       },
    //     ],
    //   }),
    // });
    //     const response = await fetch(endpoint, {
    //       method: "POST",
    //       headers: {
    //         Authorization: `Bearer ${apiKey}`,
    //         "Content-Type": "application/json",
    //       },
    //       body: JSON.stringify({
    //         model: "llama-3.1-8b-instant",
    //         temperature: 0,
    //         max_tokens: 1536, // Note: The standard API uses 'max_tokens', not 'maxOutputTokens'
    //         response_format: { type: "json_object" }, // Forces valid JSON output
    //         messages: [
    //           {
    //             role: "system",
    //             content: `You are a strict data extraction bot.
    // RULES:
    // 1. Output ONLY valid JSON.
    // 2. MINIFIED format only. NO spaces, NO line breaks.
    // 3. Use exactly these keys: {"p":"providerName","items":[{"n":"name","q":qty,"t":"unit","a":amount}]}
    // 4. DO NOT add extra keys.`,
    //           },
    //           // {
    //           //   role: "user",
    //           //   content: `Extract ALL items:\nStore: Zepto\n1x Onion (kg) - 43.00\n5x Rice (kg) - 250.00`,
    //           // },
    //           // {
    //           //   role: "assistant",
    //           //   content: `{"p":"Zepto","items":[{"n":"Onion","q":1,"t":"kg","a":43},{"n":"Rice","q":5,"t":"kg","a":250}]}`,
    //           // },
    //           {
    //             role: "user",
    //             content: `Extract ALL items:\n${invoiceText}`,
    //           },
    //         ],
    //       }),
    //     });

    // Handle rate limits or bad keys gracefully
    if (!response.ok) {
      const errorData = await response.json();
      msgCB(`Error: Unable to parse invoice`);
      throw new Error(
        `Groq API Error: ${response.status} - ${errorData.error?.message || response.statusText}`,
      );
    }

    const data = await response.json();

    // The model's response is located deep in the 'choices' array
    const text = data.choices[0].message.content;
    console.log("⚡ Groq Output:", text);

    // Because we used response_format: 'json_object', this parse should never fail
    const output: ParsedData = { items: [] };
    const parsed = JSON.parse(text);
    output.providerName = parsed?.p as string;
    output.discount = parsed?.d as number;
    output.fees = parsed?.f as number;
    output.invoiceTotal = parsed?.v as number;
    (parsed?.items || []).forEach((item: any) => {
      const obj = {
        productName: item?.n as string,
        quantity: item?.q as number,
        quantityType: item?.t as string,
        amount: item?.a as number,
      };
      output.items?.push(obj);
    });
    return output;
  } catch (error) {
    console.error("❌ Extraction Failed:", error);
    msgCB(`Error: Unable to parse invoice`);
    return null;
  }
}

export const parseInvoicePDFLocal = async (
  cleanLines: string[],
  msgCB: MsgCB,
  progressCB: ProgressCB,
): Promise<ParsedData | undefined | void | null> => {
  const modelId =
    "bartowski/Llama-3.2-1B-Instruct-GGUF/Llama-3.2-1B-Instruct-Q4_K_M.gguf";

  try {
    console.log("🔍 Checking model status...");
    const isAvailable = await isModelDownloaded(modelId);
    console.log("Is Model Available on Device?:", isAvailable);

    if (!isAvailable) {
      const procide = await customConfirm({
        id: getRandomStr(),
        title: "Big download (500mb+)",
        body: "This will download a small ai model to parse the invoice text, Are you sure you want to procide?",
        confirmTxt: "Downlaod",
      });
      if (procide === false) return;
      console.log("⬇️ Starting fresh download... Please wait.");

      // Standalone downloader (safest method)
      await downloadModel(modelId, (progress) => {
        console.log(`Downloading: ${progress.percentage}%`);
        progressCB(progress.percentage, false, false);
      });
      msgCB(`Download Complete!`);

      console.log("✅ Download Complete!");
    } else {
      console.log("✅ Model already exists on device!");
    }

    // Resolve the actual file system path for the downloaded model
    const modelPath = getModelPath(modelId);

    // Now pass the real file path (not the HuggingFace ID) to the Vercel AI SDK
    const model = llama.languageModel(modelPath, {
      contextParams: {
        // n_ctx: 4096,
        // n_batch: 512, // Larger batch = faster prompt processing
        // flash_attn: true, // Flash attention for faster inference
        n_ctx: 2048, // Reduced to save Android RAM and processing time
        n_batch: 512, // Keep this manageable for mobile CPUs
        n_threads: 4, // CRITICAL: Set to 2 or 4 to use only Performance cores
        flash_attn_type: "auto", // Keep true to save memory
        n_gpu_layers: 99,
      },
    });

    console.log("🧠 Loading model into RAM...");
    await model.prepare();
    msgCB(`Model loaded into RAM!`);
    progressCB(100, true, false);
    console.log("✅ Model successfully loaded into RAM!");

    const invoiceText = cleanLines.join("\n");
    if (!invoiceText) return console.error("No text found");

    console.log("Generating JSON...");

    const { text } = await generateText({
      model: model,
      temperature: 0,
      maxOutputTokens: 2048, // Increased so it doesn't get cut off
      // If your AI SDK/provider supports it, uncomment the line below to force JSON formatting:
      // responseFormat: { type: 'json_object' },
      system: `You are a strict data extraction bot.
RULES:
1. Output ONLY valid JSON.
2. MINIFIED format only. NO spaces, NO line breaks.
3. Use exactly these keys: {"p":"providerName","v":invoiceTotal,"f":fees,"d":deductions,"items":[{"n":"name","q":qty,"t":"unit","a":taxInclusiveAmount}]}
4. "a" MUST be the final item total INCLUSIVE of all taxes (CGST, SGST, Cess) and item-level discounts (e.g., use the "Total Amt" column, NEVER the "Taxable Amt").
5. "v" is the final overall Invoice Total.
6. "f" represents overall extra charges like Handling or Delivery fees. (Use 0 if none).
7. "d" represents bill-level deductions like Wallet Debits. (Use 0 if none).
8. MATHEMATICAL CHECK: The sum of all item amounts ("a") PLUS fees ("f") MINUS deductions ("d") MUST equal the invoice total ("v").
9. DO NOT add extra keys.`,
      messages: [
        {
          role: "user",
          content: `Extract ALL items as minified json:\n${invoiceText}`,
        },
      ],
    });

    console.log("Raw AI output:", text);

    // Robust JSON extraction: strip markdown fences, find JSON boundaries
    let jsonStr = text.trim();
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const firstBrace = jsonStr.indexOf("{");
    const lastBrace = jsonStr.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1)
      throw new Error("No JSON object found in AI response");
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);

    const raw = JSON.parse(jsonStr);

    // Map short keys back to full names & strip any unwanted keys
    const parsedData: ParsedData = {
      providerName: raw.p ?? raw.providerName ?? null,
      discount: raw.d ?? raw.discount ?? 0,
      invoiceTotal: raw.v ?? raw.invoiceTotal ?? 0,
      fees: raw.f ?? raw.fees ?? 0,
      items: Array.isArray(raw.items)
        ? raw.items.map((item: any) => ({
            productName: String(item.n ?? item.productName ?? ""),
            quantity: Number(item.q ?? item.quantity ?? 0),
            quantityType: String(item.t ?? item.quantityType ?? "pcs"),
            amount: Number(item.a ?? item.amount ?? 0),
          }))
        : [],
    };
    console.log("✅ SUCCESS! Parsed JSON:", parsedData);

    // 5. Unload from RAM
    await model.unload();
    msgCB(`Model unloaded from RAM!`);

    return parsedData;
  } catch (error) {
    console.error("❌ AI Extraction Error:", error);
    return null;
  }
};

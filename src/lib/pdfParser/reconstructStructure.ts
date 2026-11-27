import {
  ParsedPdfMetadata,
  ParsedPdfPage,
  ParsedPdfResult,
  ParsedPdfTable,
  ParsedPdfTextBlock,
  RawPdfPage,
  RawPdfTextItem,
  TableBoundingBox,
} from "./types";

import { cleanDuplicatedWords } from "./textUtils";

interface ExtractedLine {
  y: number;
  minY: number;
  maxY: number;
  minX: number;
  maxX: number;
  height: number;
  items: RawPdfTextItem[];
  text: string;
}

interface ColumnCluster {
  minX: number;
  maxX: number;
  text: string;
}

interface ActiveTableColumn {
  minX: number;
  maxX: number;
}

interface ActiveTable {
  columns: ActiveTableColumn[];
  rows: string[][];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  lastY: number;
  avgLineHeight: number;
}

/**
 * Reconstructs structured data (tables, multi-line cells, text blocks, and full text)
 * from positioned text items extracted from a PDF.
 *
 * Strict Fallback: Returns `{}` if the input is empty, invalid, corrupted, or if an error occurs.
 */
export function reconstructStructure(
  rawPages?: RawPdfPage[] | null,
  metadata?: ParsedPdfMetadata | null,
): ParsedPdfResult {
  try {
    if (!rawPages || !Array.isArray(rawPages) || rawPages.length === 0) {
      return {};
    }

    const pages: ParsedPdfPage[] = [];
    const allTables: ParsedPdfTable[] = [];
    const fullTextParts: string[] = [];

    for (const rawPage of rawPages) {
      const pageResult = processPage(rawPage);
      pages.push(pageResult);
      if (pageResult.tables.length > 0) {
        allTables.push(...pageResult.tables);
      }
      if (pageResult.text) {
        fullTextParts.push(pageResult.text);
      }
    }

    const finalMetadata: ParsedPdfMetadata = {
      numPages: rawPages.length,
      ...(metadata || {}),
    };

    return {
      metadata: finalMetadata,
      pages,
      tables: allTables,
      text: fullTextParts.join("\n\n"),
    };
  } catch {
    // Strict fallback on any error or corruption
    return {};
  }
}

/**
 * Processes a single raw page into lines, detects tables and multi-line cells,
 * and groups remaining text into textBlocks.
 */
function processPage(rawPage: RawPdfPage): ParsedPdfPage {
  const pageNumber = rawPage.pageNumber || 1;
  const rawItems = (rawPage.items || []).filter(
    (item) => item && typeof item.str === "string" && item.str.trim().length > 0,
  );

  if (rawItems.length === 0) {
    return {
      pageNumber,
      tables: [],
      textBlocks: [],
      text: "",
    };
  }

  // 1. Sort items top-to-bottom (Y descending in PDF coordinates)
  // and left-to-right (X ascending)
  const sortedItems = [...rawItems].sort((a, b) => {
    const yDiff = b.y - a.y; // PDF Y: higher value is higher on page (closer to top)
    const yTolerance = Math.min(a.height || 10, b.height || 10) * 0.4;
    if (Math.abs(yDiff) <= yTolerance) {
      return a.x - b.x; // same line: left to right
    }
    return yDiff; // top to bottom
  });

  // 2. Group items into horizontal lines
  const lines: ExtractedLine[] = [];
  let currentLineItems: RawPdfTextItem[] = [];
  let currentLineY = -1;
  let currentLineHeight = 10;

  for (const item of sortedItems) {
    const itemHeight = item.height || 10;
    const tolerance = Math.max(3, Math.min(currentLineHeight, itemHeight) * 0.45);

    if (currentLineY === -1 || Math.abs(item.y - currentLineY) <= tolerance) {
      currentLineItems.push(item);
      if (currentLineY === -1) {
        currentLineY = item.y;
        currentLineHeight = itemHeight;
      } else {
        currentLineHeight = Math.max(currentLineHeight, itemHeight);
      }
    } else {
      // Finalize current line
      lines.push(buildLine(currentLineItems, currentLineY, currentLineHeight));

      // Start new line
      currentLineItems = [item];
      currentLineY = item.y;
      currentLineHeight = itemHeight;
    }
  }

  if (currentLineItems.length > 0) {
    lines.push(buildLine(currentLineItems, currentLineY, currentLineHeight));
  }

  // 3. Segment lines into Tables vs TextBlocks
  const tables: ParsedPdfTable[] = [];
  const textBlocks: ParsedPdfTextBlock[] = [];
  let activeTable: ActiveTable | null = null;
  let activeTextBlockLines: ExtractedLine[] = [];

  const finalizeActiveTable = () => {
    if (!activeTable) return;
    if (activeTable.rows.length >= 2 && activeTable.columns.length >= 2) {
      const parsedTable = buildParsedTable(activeTable);
      if (parsedTable) {
        tables.push(parsedTable);
      }
    } else {
      // If table wasn't multi-row/multi-column, treat its lines as text blocks
      for (const row of activeTable.rows) {
        const text = row.filter(Boolean).join(" ");
        if (text) {
          activeTextBlockLines.push({
            y: activeTable.lastY,
            minY: activeTable.minY,
            maxY: activeTable.maxY,
            minX: activeTable.minX,
            maxX: activeTable.maxX,
            height: activeTable.avgLineHeight,
            items: [],
            text,
          });
        }
      }
    }
    activeTable = null;
  };

  const finalizeActiveTextBlock = () => {
    if (activeTextBlockLines.length === 0) return;
    const minX = Math.min(...activeTextBlockLines.map((l) => l.minX));
    const maxX = Math.max(...activeTextBlockLines.map((l) => l.maxX));
    const minY = Math.min(...activeTextBlockLines.map((l) => l.minY));
    const maxY = Math.max(...activeTextBlockLines.map((l) => l.maxY));
    const linesText = activeTextBlockLines.map((l) => l.text);

    textBlocks.push({
      text: linesText.join("\n"),
      lines: linesText,
      bbox: {
        x: Math.round(minX),
        y: Math.round(minY),
        width: Math.round(maxX - minX),
        height: Math.round(maxY - minY),
      },
    });
    activeTextBlockLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const clusters = clusterLineIntoColumns(line);

    if (activeTable) {
      const verticalGap = activeTable.lastY - line.y;
      const maxAllowedGap = Math.max(35, activeTable.avgLineHeight * 2.8);

      if (verticalGap > maxAllowedGap || verticalGap < -5) {
        // Vertical gap too large: table boundary reached
        finalizeActiveTable();
      } else {
        // Check if line matches active table columns
        const match = matchLineToTable(activeTable, clusters, line);

        if (match.type === "WRAPPED_CELL") {
          // Multi-line cell continuation
          const lastRow = activeTable.rows[activeTable.rows.length - 1];
          const colIdx = match.targetColumnIndex;
          const existingText = lastRow[colIdx] || "";
          lastRow[colIdx] = existingText ? `${existingText}\n${match.cellText}` : match.cellText;

          activeTable.minY = Math.min(activeTable.minY, line.minY);
          activeTable.minX = Math.min(activeTable.minX, line.minX);
          activeTable.maxX = Math.max(activeTable.maxX, line.maxX);
          activeTable.lastY = line.y;
          continue;
        } else if (match.type === "NEW_ROW") {
          // New row in current table
          activeTable.rows.push(match.row);
          activeTable.minY = Math.min(activeTable.minY, line.minY);
          activeTable.minX = Math.min(activeTable.minX, line.minX);
          activeTable.maxX = Math.max(activeTable.maxX, line.maxX);
          activeTable.lastY = line.y;
          // Update column boundaries with new items
          updateTableColumns(activeTable, clusters);
          continue;
        } else {
          // Line does not fit current table layout: finalize table
          finalizeActiveTable();
        }
      }
    }

    // If no active table, can this line start a new table?
    if (!activeTable && clusters.length >= 2) {
      // Lookahead: does the next line also have multi-column alignment or continuation?
      const nextLine = lines[i + 1];
      if (nextLine) {
        const nextClusters = clusterLineIntoColumns(nextLine);
        const verticalGap = line.y - nextLine.y;
        const maxGap = Math.max(35, line.height * 2.8);

        if (verticalGap <= maxGap && nextClusters.length >= 1) {
          finalizeActiveTextBlock();
          activeTable = initActiveTable(clusters, line);
          continue;
        }
      }
    }

    // Non-table line: treat as text block
    if (activeTextBlockLines.length > 0) {
      const prevLine = activeTextBlockLines[activeTextBlockLines.length - 1];
      const gap = prevLine.y - line.y;
      if (gap > Math.max(25, prevLine.height * 2.5)) {
        // Large gap between paragraphs
        finalizeActiveTextBlock();
      }
    }
    activeTextBlockLines.push(line);
  }

  finalizeActiveTable();
  finalizeActiveTextBlock();

  // Full page text in reading order
  const pageText = lines.map((l) => l.text).join("\n");

  return {
    pageNumber,
    tables,
    textBlocks,
    text: pageText,
  };
}

/**
 * Builds an ExtractedLine from text items belonging to the same horizontal level.
 */
function buildLine(
  items: RawPdfTextItem[],
  lineY: number,
  lineHeight: number,
): ExtractedLine {
  // Sort items left-to-right
  const sorted = [...items].sort((a, b) => a.x - b.x);

  // Filter out shadow/fake-bold duplicate items placed at virtually the same coordinates
  const cleanItems: RawPdfTextItem[] = [];
  for (const item of sorted) {
    if (cleanItems.length > 0) {
      const prev = cleanItems[cleanItems.length - 1];
      const sameText = item.str.trim() === prev.str.trim();
      const nearSameX = Math.abs(item.x - prev.x) <= 3;
      const overlapsSignificantly = item.x < prev.x + (prev.width || 0) * 0.7;

      if (sameText && (nearSameX || overlapsSignificantly)) {
        continue;
      }
    }
    cleanItems.push(item);
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const textTokens: string[] = [];

  for (let i = 0; i < cleanItems.length; i++) {
    const item = cleanItems[i];
    const itemW = item.width || 0;
    const itemH = item.height || lineHeight;

    minX = Math.min(minX, item.x);
    maxX = Math.max(maxX, item.x + itemW);
    minY = Math.min(minY, item.y);
    maxY = Math.max(maxY, item.y + itemH);

    if (i === 0) {
      textTokens.push(item.str);
    } else {
      const prev = cleanItems[i - 1];
      const prevEnd = prev.x + (prev.width || 0);
      const gap = item.x - prevEnd;

      const fontH = Math.min(prev.height || lineHeight, itemH);
      const minSpaceGap = Math.max(0.4, fontH * 0.1);

      // If gap is very small (connected kerning characters), don't insert space
      if (gap < minSpaceGap) {
        textTokens.push(item.str);
      } else {
        textTokens.push(` ${item.str}`);
      }
    }
  }

  const rawLineText = textTokens.join("").trim();
  const cleanedLineText = cleanDuplicatedWords(rawLineText);

  return {
    y: lineY,
    minY: minY === Infinity ? lineY : minY,
    maxY: maxY === -Infinity ? lineY + lineHeight : maxY,
    minX: minX === Infinity ? 0 : minX,
    maxX: maxX === -Infinity ? 0 : maxX,
    height: lineHeight,
    items: cleanItems,
    text: cleanedLineText,
  };
}

/**
 * Clusters items on a line into horizontal column spans based on gaps between words.
 */
function clusterLineIntoColumns(line: ExtractedLine): ColumnCluster[] {
  if (line.items.length === 0) {
    return [];
  }

  const clusters: ColumnCluster[] = [];
  let currentClusterItems: RawPdfTextItem[] = [line.items[0]];
  let clusterMinX = line.items[0].x;
  let clusterMaxX = line.items[0].x + (line.items[0].width || 0);

  // Column separation gap threshold (points in PDF space)
  const COLUMN_GAP_THRESHOLD = 14;

  for (let i = 1; i < line.items.length; i++) {
    const item = line.items[i];
    const prevItem = line.items[i - 1];
    const prevEnd = prevItem.x + (prevItem.width || 0);
    const gap = item.x - prevEnd;

    if (gap >= COLUMN_GAP_THRESHOLD) {
      // Split into distinct column
      clusters.push({
        minX: clusterMinX,
        maxX: clusterMaxX,
        text: currentClusterItems.map((it) => it.str).join(" ").trim(),
      });
      currentClusterItems = [item];
      clusterMinX = item.x;
      clusterMaxX = item.x + (item.width || 0);
    } else {
      currentClusterItems.push(item);
      clusterMaxX = Math.max(clusterMaxX, item.x + (item.width || 0));
    }
  }

  if (currentClusterItems.length > 0) {
    clusters.push({
      minX: clusterMinX,
      maxX: clusterMaxX,
      text: currentClusterItems.map((it) => it.str).join(" ").trim(),
    });
  }

  return clusters;
}

/**
 * Initializes a new table builder from the starting line.
 */
function initActiveTable(clusters: ColumnCluster[], line: ExtractedLine): ActiveTable {
  const columns: ActiveTableColumn[] = clusters.map((c) => ({
    minX: c.minX,
    maxX: c.maxX,
  }));

  const firstRow = clusters.map((c) => c.text);

  return {
    columns,
    rows: [firstRow],
    minX: line.minX,
    maxX: line.maxX,
    minY: line.minY,
    maxY: line.maxY,
    lastY: line.y,
    avgLineHeight: line.height,
  };
}

type MatchResult =
  | { type: "WRAPPED_CELL"; targetColumnIndex: number; cellText: string }
  | { type: "NEW_ROW"; row: string[] }
  | { type: "MISMATCH" };

/**
 * Matches a line's clusters to the columns of an active table.
 * Detects whether this line is a multi-line cell continuation, a new row, or a mismatch.
 */
function matchLineToTable(
  table: ActiveTable,
  clusters: ColumnCluster[],
  line: ExtractedLine,
): MatchResult {
  if (clusters.length === 0) return { type: "MISMATCH" };

  const numCols = table.columns.length;
  // A narrow 2-3 column header/address table must not swallow a wider multi-column item table
  if (numCols <= 3 && clusters.length >= numCols + 2 && clusters.length >= 4) {
    return { type: "MISMATCH" };
  }
  const COLUMN_TOLERANCE = 22;

  // Find column index for a given cluster
  const findColumnIndex = (cluster: ColumnCluster): number => {
    let bestIdx = -1;
    let minDistance = Infinity;

    for (let c = 0; c < numCols; c++) {
      const col = table.columns[c];
      // Check overlap or proximity
      const overlap = Math.min(cluster.maxX, col.maxX) - Math.max(cluster.minX, col.minX);
      if (overlap > -COLUMN_TOLERANCE) {
        const dist = Math.abs((cluster.minX + cluster.maxX) / 2 - (col.minX + col.maxX) / 2);
        if (dist < minDistance) {
          minDistance = dist;
          bestIdx = c;
        }
      }
    }
    return bestIdx;
  };

  // Case 1: Wrapped Cell Continuation
  // If line has only 1 cluster, check if it strictly fits inside one existing column
  if (clusters.length === 1) {
    const colIdx = findColumnIndex(clusters[0]);
    if (colIdx !== -1) {
      const col = table.columns[colIdx];
      const cluster = clusters[0];
      const clusterWidth = cluster.maxX - cluster.minX;
      const colWidth = col.maxX - col.minX;

      // Ensure it doesn't span across multiple column widths (not a full paragraph)
      if (clusterWidth <= colWidth * 1.5 + COLUMN_TOLERANCE) {
        return {
          type: "WRAPPED_CELL",
          targetColumnIndex: colIdx,
          cellText: cluster.text,
        };
      }
    }
  }

  // Case 2: New Table Row
  // Map clusters to columns
  const assignedRow = new Array<string>(numCols).fill("");
  let matchCount = 0;

  for (const cluster of clusters) {
    const colIdx = findColumnIndex(cluster);
    if (colIdx !== -1) {
      if (assignedRow[colIdx]) {
        assignedRow[colIdx] += ` ${cluster.text}`;
      } else {
        assignedRow[colIdx] = cluster.text;
      }
      matchCount++;
    }
  }

  // If at least half the clusters mapped or at least 2 columns mapped
  if (matchCount >= 2 || (clusters.length === 1 && matchCount === 1 && numCols === 2)) {
    return {
      type: "NEW_ROW",
      row: assignedRow,
    };
  }

  return { type: "MISMATCH" };
}

/**
 * Expands column bounding boundaries as new rows are added.
 */
function updateTableColumns(table: ActiveTable, clusters: ColumnCluster[]) {
  const COLUMN_TOLERANCE = 22;
  for (const cluster of clusters) {
    for (const col of table.columns) {
      const overlap = Math.min(cluster.maxX, col.maxX) - Math.max(cluster.minX, col.minX);
      if (overlap > -COLUMN_TOLERANCE) {
        col.minX = Math.min(col.minX, cluster.minX);
        col.maxX = Math.max(col.maxX, cluster.maxX);
        break;
      }
    }
  }
}

/**
 * Builds a final ParsedPdfTable object with inferred headers and key-value records.
 */
function buildParsedTable(activeTable: ActiveTable): ParsedPdfTable | null {
  if (activeTable.rows.length === 0 || activeTable.columns.length === 0) {
    return null;
  }

  const rawRows = activeTable.rows;
  const firstRow = rawRows[0];

  // Determine if first row is a header row
  // It is a header row if it has text in most columns and isn't purely numbers
  const hasPureNumbers = firstRow.every((val) => /^[0-9.,$-]+$/.test(val.trim()));
  const isHeaderCandidate = !hasPureNumbers && firstRow.some((val) => val.trim().length > 0);

  let headers: string[];
  let dataRows: string[][];

  if (isHeaderCandidate && rawRows.length > 1) {
    headers = firstRow.map((h, i) => (h && h.trim().length > 0 ? h.trim() : `Column_${i + 1}`));
    dataRows = rawRows.slice(1);
  } else {
    headers = activeTable.columns.map((_, i) => `Column_${i + 1}`);
    dataRows = rawRows;
  }

  // Create key-value data records
  const data: Record<string, string>[] = [];
  for (const row of dataRows) {
    const record: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const colName = headers[c];
      record[colName] = row[c] || "";
    }
    data.push(record);
  }

  const bbox: TableBoundingBox = {
    x: Math.round(activeTable.minX),
    y: Math.round(activeTable.minY),
    width: Math.round(activeTable.maxX - activeTable.minX),
    height: Math.round(activeTable.maxY - activeTable.minY),
  };

  return {
    headers,
    rows: dataRows,
    data,
    rowCount: dataRows.length,
    colCount: headers.length,
    bbox,
  };
}

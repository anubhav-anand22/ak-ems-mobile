import { useGlobalState } from "@/lib/gState";
import { reconstructStructure } from "@/lib/pdfParser/reconstructStructure";
import { parseInvoiceData } from "@/lib/pdfParser/brandParsers";
import {
  ParsedPdfResult,
  PDFParsedData,
  RawPdfPage,
} from "@/lib/pdfParser/types";
import { usePdfParser } from "@/lib/pdfParser/usePdfParser";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  DataTable,
  Divider,
  SegmentedButtons,
  Text,
  useTheme,
} from "react-native-paper";

export function PdfParserTest() {
  const theme = useTheme();
  const setSnackbar = useGlobalState((s) => s.setSnackbar);

  const { isReady, isParsing, progressText, pickAndParsePdf, parserElement } =
    usePdfParser();

  const [activeTab, setActiveTab] = useState<"invoice" | "tables" | "text" | "json">(
    "invoice",
  );
  const [jsonMode, setJsonMode] = useState<"parsed" | "raw">("parsed");
  const [parsedData, setParsedData] = useState<ParsedPdfResult | null>(null);
  const [invoiceData, setInvoiceData] = useState<PDFParsedData | null>(null);
  const [fileDetails, setFileDetails] = useState<{
    name?: string;
    size?: number;
    uri?: string;
  } | null>(null);

  const handlePickFile = async () => {
    try {
      const res = await pickAndParsePdf();
      if (res.fileUri) {
        setFileDetails({
          name: res.fileName,
          size: res.fileSize,
          uri: res.fileUri,
        });
        setParsedData(res.result);
        const inv = parseInvoiceData(res.result);
        setInvoiceData(inv);
        setSnackbar({
          message: `Parsed ${inv.invoiceFrom || "Invoice"}: ${inv.items.length} items found`,
          type: "info",
        });
      }
    } catch {
      setSnackbar({
        message: "Failed to parse selected PDF",
        type: "error",
      });
    }
  };

  const handleRunBigBasketSample = () => {
    const rawResult: ParsedPdfResult = {
      metadata: { numPages: 1 },
      pages: [
        {
          pageNumber: 1,
          tables: [
            {
              headers: [
                "SI No.",
                "Item Description",
                "HSN Code",
                "Quantity",
                "Unit Price*",
                "Unit Taxable Value",
                "Gross Value*",
                "Discount/ Margin*",
                "Other Charges***",
                "Taxable Value",
                "CGST Rate(%) Amount",
                "SGST/ UTGST Rate(%) Amount",
                "CESS Amount",
                "TOTAL Value",
              ],
              rows: [
                [
                  "1",
                  "fresho! Potato - New 1 kg\n2 Days Return",
                  "07019000",
                  "4",
                  "36.25",
                  "24.18",
                  "149.72",
                  "53.00",
                  "4.72",
                  "96.72",
                  "0.00% 0.00",
                  "0.00% 0.00",
                  "0.00",
                  "96.72",
                ],
                [
                  "2",
                  "Lay's Spanish Tomato\nTango Potato Chips 48 g\nNon-Returnable",
                  "21061000",
                  "1",
                  "25.00",
                  "9.00",
                  "25.46",
                  "16.00",
                  "0.46",
                  "9.00",
                  "2.50% 0.23",
                  "2.50% 0.23",
                  "0.00",
                  "9.46",
                ],
                [
                  "3",
                  "Lay's India's Magic\nMasala Potato Chips 48 g\nNon-Returnable",
                  "21061000",
                  "1",
                  "25.00",
                  "9.00",
                  "25.46",
                  "16.00",
                  "0.46",
                  "9.00",
                  "2.50% 0.23",
                  "2.50% 0.23",
                  "0.00",
                  "9.46",
                ],
                [
                  "4",
                  "Mother Dairy Classic Dahi\n80 g Cup\n7 Days Return",
                  "04039010",
                  "1",
                  "10.00",
                  "10.01",
                  "10.51",
                  "0.00",
                  "0.51",
                  "10.01",
                  "2.50% 0.25",
                  "2.50% 0.25",
                  "0.00",
                  "10.51",
                ],
                [
                  "5",
                  "Amul Gold Full Cream\nMilk 500 ml Pouch\n7 Days Return",
                  "04012000",
                  "1",
                  "36.00",
                  "37.85",
                  "37.85",
                  "0.00",
                  "1.85",
                  "37.85",
                  "0.00% 0.00",
                  "0.00% 0.00",
                  "0.00",
                  "37.85",
                ],
              ],
              data: [],
              rowCount: 5,
              colCount: 14,
            },
          ],
          textBlocks: [],
          text: `Original Tax Invoice
Details of Supplier Bill to/Ship to: Invoice Number IBNUP26INDH32923
Invoice Date 2026-11-14
Order No BNN-2157071183-20261114
Slot Sat 14 Nov 2026 between 12:00 AM and 11:00 PM
Payable Amount Rs. 153.00
Payment Mode UPI_QR
Source bbnow
No. of Items 5
Handling Charge Rs.8.00
Sub Total Rs.164.00
Free Cash Rs.11.00
Final Total Rs.153.00`,
        },
      ],
      tables: [],
      text: "",
    };

    rawResult.tables = rawResult.pages![0].tables;
    rawResult.text = rawResult.pages![0].text;

    setFileDetails({
      name: "bigbasket-sample-invoice.pdf",
      size: 28400,
    });
    setParsedData(rawResult);
    const inv = parseInvoiceData(rawResult);
    setInvoiceData(inv);
    setActiveTab("invoice");
    setSnackbar({
      message: "BigBasket sample parsed: 5 items, Total: ₹153.00",
      type: "info",
    });
  };

  const handleRunBlinkitSample = () => {
    const rawResult: ParsedPdfResult = {
      metadata: { numPages: 1 },
      pages: [
        {
          pageNumber: 1,
          tables: [
            {
              headers: [
                "Sr No",
                "Description of Goods",
                "Quantity",
                "UQC",
                "HSN/SAC Code",
                "Taxable Value",
                "Discount",
                "Net Taxable Value",
                "CGST%",
                "CGST",
                "SGST%",
                "SGST",
                "Cess%",
                "Cess",
                "Additional Cess",
                "Total Amount (Rs.)",
              ],
              rows: [
                [
                  "1.",
                  "MAGGI 2-Minute Instant\nNoodles, Made With\nQuality Spices",
                  "1",
                  "NOS",
                  "19021900",
                  "85.71",
                  "8.57",
                  "77.14",
                  "2.5",
                  "1.93",
                  "2.5",
                  "1.93",
                  "0",
                  "0",
                  "0",
                  "81",
                ],
                [
                  "2.",
                  "Ghadi Detergent Powder",
                  "1",
                  "NOS",
                  "34029011",
                  "68.64",
                  "2.54",
                  "66.1",
                  "9",
                  "5.95",
                  "9",
                  "5.95",
                  "0",
                  "0",
                  "0",
                  "78",
                ],
                [
                  "3.",
                  "Bingo Tedhe Medhe\nMasala Tadka",
                  "1",
                  "NOS",
                  "21069099",
                  "19.05",
                  "4.76",
                  "14.29",
                  "2.5",
                  "0.36",
                  "2.5",
                  "0.36",
                  "0",
                  "0",
                  "0",
                  "15",
                ],
                [
                  "4.",
                  "Bingo Tedhe Medhe\nChatpata Twist",
                  "1",
                  "NOS",
                  "21069099",
                  "19.05",
                  "3.81",
                  "15.24",
                  "2.5",
                  "0.38",
                  "2.5",
                  "0.38",
                  "0",
                  "0",
                  "0",
                  "16",
                ],
              ],
              data: [],
              rowCount: 4,
              colCount: 16,
            },
          ],
          textBlocks: [],
          text: `TAX INVOICE
Invoice To: Anubhav Anand Seller Name: PYD Retail Pvt Ltd - Alpha 1
Order ID: 244639707177253
Invoice No: 260802IMAP100599
Date of Invoice: 02-08-2026
Invoice Value 190
Handling Fee (Inclusive of GST) 7.81
197.81`,
        },
      ],
      tables: [],
      text: "",
    };

    rawResult.tables = rawResult.pages![0].tables;
    rawResult.text = rawResult.pages![0].text;

    setFileDetails({
      name: "blinkit-sample-invoice.pdf",
      size: 32000,
    });
    setParsedData(rawResult);
    const inv = parseInvoiceData(rawResult);
    setInvoiceData(inv);
    setActiveTab("invoice");
    setSnackbar({
      message: "Blinkit sample parsed: 4 items, Total: ₹197.81",
      type: "info",
    });
  };

  const handleRunZeptoSample = () => {
    const rawResult: ParsedPdfResult = {
      metadata: { numPages: 1 },
      pages: [
        {
          pageNumber: 1,
          tables: [
            {
              headers: [
                "SR No",
                "Item & Description",
                "Unit MRP/RSP",
                "HSN",
                "Qty",
                "Product Rate",
                "Disc.",
                "Taxable Amt.",
                "CGST",
                "S/UT GST",
                "CGST Amt.",
                "S/UT GST Amt.",
                "Cess",
                "Cess Amt.",
                "Total Amt.",
              ],
              rows: [
                [
                  "1",
                  "Daily Good\nChana Brown 1\npack (1 kg)",
                  "175.00",
                  "07132010",
                  "1",
                  "166.67",
                  "40.00%",
                  "100.00",
                  "2.50%",
                  "2.50%",
                  "2.50",
                  "2.50",
                  "0.00% + 0.00",
                  "0.00",
                  "105.00",
                ],
                [
                  "2",
                  "Daily Good\nSooji / Rava 1 pack (500\ng)",
                  "55.00",
                  "11029090",
                  "1",
                  "52.38",
                  "54.54%",
                  "23.81",
                  "2.50%",
                  "2.50%",
                  "0.60",
                  "0.60",
                  "0.00% + 0.00",
                  "0.00",
                  "25.00",
                ],
                [
                  "3",
                  "BestValue Kabuli\nChana 1\npack (500\ng)",
                  "100.00",
                  "07132010",
                  "1",
                  "95.24",
                  "45.00%",
                  "52.38",
                  "2.50%",
                  "2.50%",
                  "1.31",
                  "1.31",
                  "0.00% + 0.00",
                  "0.00",
                  "55.00",
                ],
                [
                  "4",
                  "Potato 900\ng - 1 kg",
                  "42.00",
                  "07019000",
                  "1",
                  "41.99",
                  "47.61%",
                  "22.00",
                  "0.00%",
                  "0.00%",
                  "0.00",
                  "0.00",
                  "0.00% + 0.00",
                  "0.00",
                  "22.00",
                ],
              ],
              data: [],
              rowCount: 4,
              colCount: 15,
            },
          ],
          textBlocks: [],
          text: `Seller Name: Commodum Groceries Private Limited
TAX INVOICE/BILL OF SUPPLY
Invoice No.: 26099C0009334691
Order No.: RJKMJNOAP46118A
Place Of Supply : UTTAR PRADESH (9)
Date : 30-09-2026
Item Total 207.01
Invoice Value 207.01
E-commerce Platform (FBO) Information - ZEPTO MARKETPLACE PRIVATE LIMITED
support@zeptonow.com`,
        },
      ],
      tables: [],
      text: "",
    };

    rawResult.tables = rawResult.pages![0].tables;
    rawResult.text = rawResult.pages![0].text;

    setFileDetails({
      name: "zepto-sample-invoice.pdf",
      size: 34500,
    });
    setParsedData(rawResult);
    const inv = parseInvoiceData(rawResult);
    setInvoiceData(inv);
    setActiveTab("invoice");
    setSnackbar({
      message: "Zepto sample parsed: 4 items, Total: ₹207.01",
      type: "info",
    });
  };

  const handleClear = () => {
    setParsedData(null);
    setInvoiceData(null);
    setFileDetails(null);
  };

  const tables = parsedData?.tables || [];
  const textBlocks = parsedData?.pages?.flatMap((p) => p.textBlocks) || [];

  return (
    <View style={styles.container}>
      {/* Hidden off-screen WebView parser element */}
      {parserElement}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Engine Status Card */}
        <Card style={styles.statusCard}>
          <Card.Content>
            <View style={styles.statusRow}>
              <Text variant="labelLarge">WebView Engine:</Text>
              <Chip
                icon={isReady ? "check-circle" : "clock-outline"}
                compact
                style={{
                  backgroundColor: isReady
                    ? theme.colors.primaryContainer
                    : theme.colors.surfaceVariant,
                }}
              >
                {isReady ? "Ready (Off-Screen)" : "Initializing..."}
              </Chip>
            </View>

            {fileDetails && (
              <View style={styles.fileDetailsRow}>
                <Text variant="bodySmall">
                  📄 <Text style={{ fontWeight: "bold" }}>{fileDetails.name}</Text>
                  {fileDetails.size
                    ? ` (${Math.round(fileDetails.size / 1024)} KB)`
                    : ""}
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Action Controls */}
        <View style={styles.buttonRow}>
          <Button
            mode="contained"
            icon="file-document-outline"
            onPress={handlePickFile}
            loading={isParsing}
            disabled={isParsing}
            style={styles.actionBtn}
          >
            Pick PDF
          </Button>

          <Button
            mode="outlined"
            icon="basket"
            onPress={handleRunBigBasketSample}
            disabled={isParsing}
            compact
          >
            BigBasket
          </Button>

          <Button
            mode="outlined"
            icon="lightning-bolt"
            onPress={handleRunBlinkitSample}
            disabled={isParsing}
            compact
          >
            Blinkit
          </Button>

          <Button
            mode="outlined"
            icon="truck-fast"
            onPress={handleRunZeptoSample}
            disabled={isParsing}
            compact
          >
            Zepto
          </Button>

          {(parsedData || invoiceData) && (
            <Button
              mode="text"
              icon="delete-outline"
              onPress={handleClear}
              disabled={isParsing}
            >
              Clear
            </Button>
          )}
        </View>

        {/* Loading Indicator */}
        {isParsing && (
          <Card style={styles.loadingCard}>
            <Card.Content style={styles.loadingContent}>
              <ActivityIndicator
                animating={true}
                size="large"
                color={theme.colors.primary}
              />
              <Text style={styles.loadingText}>
                {progressText || "Parsing document..."}
              </Text>
            </Card.Content>
          </Card>
        )}

        {/* Results Section */}
        {(parsedData || invoiceData) && !isParsing && (
          <View style={styles.resultsContainer}>
            <SegmentedButtons
              value={activeTab}
              onValueChange={(val) => setActiveTab(val as any)}
              buttons={[
                { value: "invoice", label: `Invoice (${invoiceData?.items.length || 0})` },
                { value: "tables", label: `Tables (${tables.length})` },
                { value: "text", label: `Text` },
                { value: "json", label: "JSON" },
              ]}
              style={styles.tabs}
            />

            {/* TAB 1: Structured PDFParsedData */}
            {activeTab === "invoice" && invoiceData && (
              <View>
                <Card style={styles.invoiceSummaryCard}>
                  <Card.Content>
                    <View style={styles.summaryGrid}>
                      <View style={styles.summaryItem}>
                        <Text variant="labelSmall" style={styles.summaryLabel}>
                          Invoice From
                        </Text>
                        <Text variant="titleMedium" style={{ fontWeight: "bold" }}>
                          {invoiceData.invoiceFrom || "N/A"}
                        </Text>
                      </View>

                      <View style={styles.summaryItem}>
                        <Text variant="labelSmall" style={styles.summaryLabel}>
                          Invoice Number
                        </Text>
                        <Text variant="bodyMedium" style={{ fontWeight: "bold" }}>
                          {invoiceData.invoiceNumber || "N/A"}
                        </Text>
                      </View>

                      <View style={styles.summaryItem}>
                        <Text variant="labelSmall" style={styles.summaryLabel}>
                          Invoice Date
                        </Text>
                        <Text variant="bodyMedium">
                          {invoiceData.invoiceDate
                            ? new Date(invoiceData.invoiceDate).toLocaleDateString()
                            : "N/A"}
                        </Text>
                      </View>

                      <View style={styles.summaryItem}>
                        <Text variant="labelSmall" style={styles.summaryLabel}>
                          Items Subtotal
                        </Text>
                        <Text variant="titleMedium">
                          ₹ {invoiceData.totalAmount.toFixed(2)}
                        </Text>
                      </View>

                      <View style={styles.summaryItem}>
                        <Text variant="labelSmall" style={styles.summaryLabel}>
                          Final Total Amount
                        </Text>
                        <Text
                          variant="titleLarge"
                          style={{
                            color: theme.colors.primary,
                            fontWeight: "bold",
                          }}
                        >
                          ₹ {invoiceData.finalTotalAmount.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </Card.Content>
                </Card>

                {/* Items List */}
                <Card style={styles.tableCard}>
                  <Card.Title
                    title={`Items (${invoiceData.items.length})`}
                    subtitle="Extracted product name, quantity & value"
                  />
                  <Card.Content>
                    <DataTable>
                      <DataTable.Header>
                        <DataTable.Title style={{ flex: 3 }}>
                          <Text style={{ fontWeight: "bold" }}>Item Name</Text>
                        </DataTable.Title>
                        <DataTable.Title style={{ flex: 1 }} numeric>
                          <Text style={{ fontWeight: "bold" }}>Qty</Text>
                        </DataTable.Title>
                        <DataTable.Title style={{ flex: 1.5 }} numeric>
                          <Text style={{ fontWeight: "bold" }}>Value (₹)</Text>
                        </DataTable.Title>
                      </DataTable.Header>

                      {invoiceData.items.map((item, idx) => (
                        <DataTable.Row key={idx}>
                          <DataTable.Cell style={{ flex: 3 }}>
                            <Text variant="bodySmall">{item.itemName}</Text>
                          </DataTable.Cell>
                          <DataTable.Cell style={{ flex: 1 }} numeric>
                            <Text variant="bodySmall">{item.Quantity}</Text>
                          </DataTable.Cell>
                          <DataTable.Cell style={{ flex: 1.5 }} numeric>
                            <Text variant="bodySmall" style={{ fontWeight: "bold" }}>
                              {item.value.toFixed(2)}
                            </Text>
                          </DataTable.Cell>
                        </DataTable.Row>
                      ))}
                    </DataTable>
                  </Card.Content>
                </Card>
              </View>
            )}

            {/* TAB 2: Raw Tables */}
            {activeTab === "tables" && (
              <View>
                {tables.length === 0 ? (
                  <Text style={styles.emptyMsg}>
                    No tables detected in document.
                  </Text>
                ) : (
                  tables.map((table, tIdx) => (
                    <Card key={tIdx} style={styles.tableCard}>
                      <Card.Title
                        title={`Table ${tIdx + 1} (${table.rowCount} rows × ${table.colCount} cols)`}
                      />
                      <Card.Content>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={true}
                        >
                          <DataTable>
                            <DataTable.Header>
                              {table.headers.map((header, hIdx) => (
                                <DataTable.Title
                                  key={hIdx}
                                  style={styles.tableCell}
                                >
                                  <Text style={{ fontWeight: "bold" }}>
                                    {header}
                                  </Text>
                                </DataTable.Title>
                              ))}
                            </DataTable.Header>

                            {table.rows.map((row, rIdx) => (
                              <DataTable.Row key={rIdx}>
                                {row.map((cell, cIdx) => (
                                  <DataTable.Cell
                                    key={cIdx}
                                    style={styles.tableCell}
                                  >
                                    <Text variant="bodySmall">{cell}</Text>
                                  </DataTable.Cell>
                                ))}
                              </DataTable.Row>
                            ))}
                          </DataTable>
                        </ScrollView>
                      </Card.Content>
                    </Card>
                  ))
                )}
              </View>
            )}

            {/* TAB 3: Text Blocks */}
            {activeTab === "text" && (
              <View>
                {textBlocks.length === 0 ? (
                  <Text style={styles.emptyMsg}>No text blocks detected.</Text>
                ) : (
                  textBlocks.map((block, bIdx) => (
                    <Card key={bIdx} style={styles.blockCard}>
                      <Card.Content>
                        <Text
                          variant="labelSmall"
                          style={{ color: theme.colors.outline }}
                        >
                          Block #{bIdx + 1}
                        </Text>
                        <Divider style={{ marginVertical: 4 }} />
                        <Text variant="bodyMedium">{block.text}</Text>
                      </Card.Content>
                    </Card>
                  ))
                )}
              </View>
            )}

            {/* TAB 4: JSON Viewer */}
            {activeTab === "json" && (
              <View>
                <View style={styles.jsonToggleRow}>
                  <Button
                    mode={jsonMode === "parsed" ? "contained" : "outlined"}
                    compact
                    onPress={() => setJsonMode("parsed")}
                  >
                    PDFParsedData JSON
                  </Button>
                  <Button
                    mode={jsonMode === "raw" ? "contained" : "outlined"}
                    compact
                    onPress={() => setJsonMode("raw")}
                  >
                    Raw PDF Result JSON
                  </Button>
                </View>

                <Card style={styles.jsonCard}>
                  <Card.Content>
                    <ScrollView horizontal>
                      <Text style={styles.jsonText}>
                        {JSON.stringify(
                          jsonMode === "parsed" ? invoiceData : parsedData,
                          null,
                          2,
                        )}
                      </Text>
                    </ScrollView>
                  </Card.Content>
                </Card>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  statusCard: {
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fileDetailsRow: {
    marginTop: 8,
    gap: 4,
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
    alignItems: "center",
  },
  actionBtn: {
    flexGrow: 1,
  },
  loadingCard: {
    marginVertical: 16,
  },
  loadingContent: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 12,
  },
  loadingText: {
    fontWeight: "500",
  },
  resultsContainer: {
    marginTop: 8,
  },
  tabs: {
    marginBottom: 16,
  },
  invoiceSummaryCard: {
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  summaryItem: {
    minWidth: "45%",
    flex: 1,
  },
  summaryLabel: {
    opacity: 0.6,
    marginBottom: 2,
  },
  tableCard: {
    marginBottom: 16,
  },
  tableCell: {
    minWidth: 120,
    paddingHorizontal: 8,
  },
  blockCard: {
    marginBottom: 10,
  },
  emptyMsg: {
    textAlign: "center",
    marginVertical: 20,
    fontStyle: "italic",
    opacity: 0.7,
  },
  jsonToggleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  jsonCard: {
    marginBottom: 16,
  },
  jsonText: {
    fontFamily: "monospace",
    fontSize: 12,
  },
});

import test from "node:test";
import assert from "node:assert/strict";
import { parseInvoiceData } from "../src/lib/pdfParser/brandParsers";
import { ParsedPdfResult } from "../src/lib/pdfParser/types";

test("BigBasket Invoice Parser", async (t) => {
  await t.test("parses BigBasket / bbnow invoice accurately from real sample", () => {
    // Exact text structure from the user's provided BigBasket invoice
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
    };

    rawResult.tables = rawResult.pages![0].tables;

    const parsed = parseInvoiceData(rawResult);

    assert.equal(parsed.invoiceFrom, "BigBasket");
    assert.equal(parsed.invoiceNumber, "IBNUP26INDH32923");
    // 2026-11-14
    const d = new Date(parsed.invoiceDate);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 10); // Nov
    assert.equal(d.getDate(), 14);

    assert.equal(parsed.totalAmount, 164.0);
    assert.equal(parsed.finalTotalAmount, 153.0);

    assert.equal(parsed.items.length, 5);
    assert.equal(parsed.items[0].itemName, "fresho! Potato - New 1 kg");
    assert.equal(parsed.items[0].Quantity, "4");
    assert.equal(parsed.items[0].value, 96.72);

    assert.equal(
      parsed.items[1].itemName,
      "Lay's Spanish Tomato Tango Potato Chips 48 g",
    );
    assert.equal(parsed.items[1].Quantity, "1");
    assert.equal(parsed.items[1].value, 9.46);

    assert.equal(
      parsed.items[2].itemName,
      "Lay's India's Magic Masala Potato Chips 48 g",
    );
    assert.equal(parsed.items[2].Quantity, "1");
    assert.equal(parsed.items[2].value, 9.46);

    assert.equal(
      parsed.items[3].itemName,
      "Mother Dairy Classic Dahi 80 g Cup",
    );
    assert.equal(parsed.items[3].Quantity, "1");
    assert.equal(parsed.items[3].value, 10.51);

    assert.equal(
      parsed.items[4].itemName,
      "Amul Gold Full Cream Milk 500 ml Pouch",
    );
    assert.equal(parsed.items[4].Quantity, "1");
    assert.equal(parsed.items[4].value, 37.85);
  });

  await t.test("parses BigBasket / bbnow invoice directly from user raw uncleaned text output", () => {
    const rawText = `OriginalOriginal TaxTax InvoiceInvoice
Details of Supplier Bill to/Ship to: Invoice NumberInvoice Number IBNUP26INDH32923
Invoice DateInvoice Date 2026-11-14
Additional Information
BNN-2157071183-
Order NoOrder No
20261114
Sat 14 Nov 2026 between
SlotSlot
12:00 AM and 11:00 PM
Payable AmountPayable Amount Rs. 153.00
Payment ModePayment Mode UPI_QR
SourceSource bbnow
No. of ItemsNo. of Items 5
SGST/SGST/
CGSTCGST
SISI HSNHSN UnitUnit Unit TaxableUnit Taxable GrossGross Discount/Discount/ OtherOther TaxableTaxable UTGSTUTGST CESSCESS TOTALTOTAL
Item DescriptionItem Description QuantityQuantity Rate(%)Rate(%)
No.No. CodeCode Price*Price* ValueValue Value*Value* Margin*Margin* Charges***Charges*** ValueValue Rate(%)Rate(%) AmountAmount ValueValue
AmountAmount
AmountAmount
fresho! Potato - New 1 kg 0.00% 0.00%
1 07019000 4 36.25 24.18 149.72 53.00 4.72 96.72 0.00 96.72
2 Days Return2 Days Return 0.00 0.00
Lay's Spanish Tomato
2.50% 2.50%
2 Tango Potato Chips 48 g 21061000 1 25.00 9.00 25.46 16.00 0.46 9.00 0.00 9.46
0.23 0.23
Non-ReturnableNon-Returnable
Lay's India's Magic
2.50% 2.50%
3 Masala Potato Chips 48 g 21061000 1 25.00 9.00 25.46 16.00 0.46 9.00 0.00 9.46
0.23 0.23
Non-ReturnableNon-Returnable
Mother Dairy Classic Dahi
2.50% 2.50%
4 80 g Cup 04039010 1 10.00 10.01 10.51 0.00 0.51 10.01 0.00 10.51
0.25 0.25
7 Days Return7 Days Return
Amul Gold Full Cream
0.00% 0.00%
5 Milk 500 ml Pouch 04012000 1 36.00 37.85 37.85 0.00 1.85 37.85 0.00 37.85
0.00 0.00
7 Days Return7 Days Return
8.00 162.58 164.00
GST Information
Transaction IDTransaction ID Sub TotalSub Total Rs.164.00Rs.164.00
CGST%CGST% SaleSale Taxable ValueTaxable Value Tax ValueTax Value
3dec45aaaea651c6e155 UPI_QR Payment on2026-11-14 Rs.153
2.50% Rs.29.43 Rs.28.01 Rs.0.71
0.00% Rs.134.57 Rs.134.57 Rs.0.00 Free Cash Rs.11.00
SGST%SGST% SaleSale Taxable ValueTaxable Value Tax ValueTax Value Final TotalFinal Total Rs.153.00
0.00% Rs.134.57 Rs.134.57 Rs.0.00 You Saved:Rs.96.00
2.50% Rs.29.43 Rs.28.01 Rs.0.71 Total Invoice value (In Figure): Rs.153.00
Total Invoice value (In words): Rs.One Hundred Fifty Three Rupees
***Other Charges
Handling ChargeHandling Charge
Rs.8.00`;

    const rawResult: ParsedPdfResult = {
      metadata: { numPages: 1 },
      pages: [{ pageNumber: 1, tables: [], textBlocks: [], text: rawText }],
      tables: [],
      text: rawText,
    };

    const parsed = parseInvoiceData(rawResult);

    assert.equal(parsed.invoiceFrom, "BigBasket");
    assert.equal(parsed.invoiceNumber, "IBNUP26INDH32923");
    const d = new Date(parsed.invoiceDate);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 10);
    assert.equal(d.getDate(), 14);

    assert.equal(parsed.totalAmount, 164.0);
    assert.equal(parsed.finalTotalAmount, 153.0);
    assert.equal(parsed.items.length, 5);

    assert.equal(parsed.items[0].itemName, "fresho! Potato - New 1 kg");
    assert.equal(parsed.items[0].Quantity, "4");
    assert.equal(parsed.items[0].value, 96.72);

    assert.equal(
      parsed.items[1].itemName,
      "Lay's Spanish Tomato Tango Potato Chips 48 g",
    );
    assert.equal(parsed.items[1].Quantity, "1");
    assert.equal(parsed.items[1].value, 9.46);

    assert.equal(
      parsed.items[2].itemName,
      "Lay's India's Magic Masala Potato Chips 48 g",
    );
    assert.equal(parsed.items[2].Quantity, "1");
    assert.equal(parsed.items[2].value, 9.46);

    assert.equal(
      parsed.items[3].itemName,
      "Mother Dairy Classic Dahi 80 g Cup",
    );
    assert.equal(parsed.items[3].Quantity, "1");
    assert.equal(parsed.items[3].value, 10.51);

    assert.equal(
      parsed.items[4].itemName,
      "Amul Gold Full Cream Milk 500 ml Pouch",
    );
    assert.equal(parsed.items[4].Quantity, "1");
    assert.equal(parsed.items[4].value, 37.85);
  });
});

test("Blinkit Invoice Parser", async (t) => {
  await t.test("parses Blinkit multi-seller invoice accurately", () => {
    const rawResult: ParsedPdfResult = {
      metadata: { numPages: 2 },
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
        {
          pageNumber: 2,
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
                  "Indian Tomato (Tamatar)",
                  "1",
                  "NOS",
                  "07031010",
                  "36",
                  "35",
                  "1",
                  "0",
                  "0",
                  "0",
                  "0",
                  "0",
                  "0",
                  "0",
                  "1",
                ],
                [
                  "2.",
                  "Mother Dairy Tadka\nChach Pouch",
                  "1",
                  "NOS",
                  "04039010",
                  "9.52",
                  "0",
                  "9.52",
                  "2.5",
                  "0.24",
                  "2.5",
                  "0.24",
                  "0",
                  "0",
                  "0",
                  "10",
                ],
                [
                  "3.",
                  "Potato (Aloo) Value Pack",
                  "1",
                  "NOS",
                  "07031010",
                  "83",
                  "23",
                  "60",
                  "0",
                  "0",
                  "0",
                  "0",
                  "0",
                  "0",
                  "0",
                  "60",
                ],
                [
                  "4.",
                  "Mother Dairy\nPasteurised\nHomogenised Cow Milk",
                  "1",
                  "NOS",
                  "04011000",
                  "31",
                  "0",
                  "31",
                  "0",
                  "0",
                  "0",
                  "0",
                  "0",
                  "0",
                  "0",
                  "31",
                ],
              ],
              data: [],
              rowCount: 4,
              colCount: 16,
            },
          ],
          textBlocks: [],
          text: `TAX INVOICE
Invoice To: Anubhav Anand Seller Name: PJTJ TECHNOLOGIES PVT LTD
Order ID: 244639707177253
Invoice No: 260802IMPJQ52335
Date of Invoice: 02-08-2026
Invoice Value 102
Handling Fee (Inclusive of GST) 4.19
106.19`,
        },
      ],
      tables: [],
      text: "",
    };

    rawResult.tables = [
      ...rawResult.pages![0].tables,
      ...rawResult.pages![1].tables,
    ];
    rawResult.text = `${rawResult.pages![0].text}\n${rawResult.pages![1].text}`;

    const parsed = parseInvoiceData(rawResult);

    assert.equal(parsed.invoiceFrom, "Blinkit");
    assert.ok(parsed.invoiceNumber.includes("260802IMAP100599"));
    const d = new Date(parsed.invoiceDate);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 7); // Aug
    assert.equal(d.getDate(), 2);

    // Sum of invoice values: 190 + 102 = 292
    assert.equal(parsed.totalAmount, 292);
    // Grand total: 197.81 + 106.19 = 304
    assert.equal(parsed.finalTotalAmount, 304);

    assert.equal(parsed.items.length, 8);
    assert.equal(
      parsed.items[0].itemName,
      "MAGGI 2-Minute Instant Noodles, Made With Quality Spices",
    );
    assert.equal(parsed.items[0].Quantity, "1");
    assert.equal(parsed.items[0].value, 81);

    assert.equal(parsed.items[1].itemName, "Ghadi Detergent Powder");
    assert.equal(parsed.items[1].Quantity, "1");
    assert.equal(parsed.items[1].value, 78);

    assert.equal(
      parsed.items[7].itemName,
      "Mother Dairy Pasteurised Homogenised Cow Milk",
    );
    assert.equal(parsed.items[7].Quantity, "1");
    assert.equal(parsed.items[7].value, 31);
  });
});

test("Zepto Invoice Parser", async (t) => {
  await t.test("parses Zepto invoice accurately", () => {
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

    const parsed = parseInvoiceData(rawResult);

    assert.equal(parsed.invoiceFrom, "Zepto");
    assert.equal(parsed.invoiceNumber, "26099C0009334691");
    const d = new Date(parsed.invoiceDate);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 8); // Sep
    assert.equal(d.getDate(), 30);

    assert.equal(parsed.totalAmount, 207.01);
    assert.equal(parsed.finalTotalAmount, 207.01);

    assert.equal(parsed.items.length, 4);
    assert.equal(
      parsed.items[0].itemName,
      "Daily Good Chana Brown 1 pack (1 kg)",
    );
    assert.equal(parsed.items[0].Quantity, "1");
    assert.equal(parsed.items[0].value, 105.0);

    assert.equal(
      parsed.items[1].itemName,
      "Daily Good Sooji / Rava 1 pack (500 g)",
    );
    assert.equal(parsed.items[1].Quantity, "1");
    assert.equal(parsed.items[1].value, 25.0);
  });
});

test("Tata 1mg Invoice Parser", async (t) => {
  await t.test("parses Tata 1mg invoice with round-off and shipping/platform fees", () => {
    const page1Text = `Tax Invoice/Bill of Supply/Cash Memo (Duplicate)
Sold By Sold To Invoice no.: C013662403149927
TATA 1MG HEALTHCARE SOLUTIONS PRIVATE LIMITED Patient Name: Anubhav Anand Date : 2025-01-11
Order ID : PO01025596900665
SR. PRODUCT NAME MFR. Name BATCH NO. EXP. QTY MRP DISC TAXABLE HSN GST RATE GST AMT. TOTAL
DATE AMT. (₹) AMT. (₹) (%) (₹) AMT. (₹)
1 Supradyn Daily Multivitamin for Men Bayer MH0847 12/25 1 260.0 0.00 232.14 30049099 12 27.86 260
and Women | Daily Immunity and 2X Pharmaceuticals Pvt
Energy | Tablet - 60 Ltd
2 Shipping Fee - OTH 1 0.00 14.84 996812 12 1.78 16.62
3 Platform Fee - OTH 1 0.00 2.96 998549 12 0.36 3.32`;

    const page2Text = `GST Taxable CGST SGST IGST TOTAL QUANTITY: 1
GROSS AMOUNT: ₹260.00
SHIPPING & VAS ₹19.94 CHARGES:
DISCOUNT ₹0.00 AMOUNT:
BILL AMOUNT: ₹279.94
ROUND OFF: ₹0.06
PAYABLE AMOUNT: ₹280.00`;

    const rawResult: ParsedPdfResult = {
      metadata: { numPages: 2 },
      pages: [
        { pageNumber: 1, tables: [], textBlocks: [], text: page1Text },
        { pageNumber: 2, tables: [], textBlocks: [], text: page2Text },
      ],
      tables: [],
      text: `${page1Text}\n\n${page2Text}`,
    };

    const parsed = parseInvoiceData(rawResult);
    assert.equal(parsed.invoiceFrom, "Tata 1mg");
    assert.equal(parsed.invoiceNumber, "C013662403149927");
    const d = new Date(parsed.invoiceDate);
    assert.equal(d.getFullYear(), 2025);
    assert.equal(d.getMonth(), 0);
    assert.equal(d.getDate(), 11);

    assert.equal(parsed.totalAmount, 279.94);
    assert.equal(parsed.finalTotalAmount, 280);
    assert.equal(parsed.items.length, 3);
    assert.equal(
      parsed.items[0].itemName,
      "Supradyn Daily Multivitamin for Men and Women | Daily Immunity and 2X Energy | Tablet - 60",
    );
    assert.equal(parsed.items[0].Quantity, "1");
    assert.equal(parsed.items[0].value, 260);
    assert.equal(parsed.items[1].itemName, "Shipping Fee - OTH");
    assert.equal(parsed.items[1].value, 16.62);
    assert.equal(parsed.items[2].itemName, "Platform Fee - OTH");
    assert.equal(parsed.items[2].value, 3.32);
  });

  await t.test("parses Tata 1mg invoice with Original/Revised MRP and Handling Charges", () => {
    const page1Text = `Tax Invoice/Bill of Supply/Cash Memo
Sold By Sold To Invoice no.: C020692601314300
TATA 1MG Healthcare Solutions Private Limited Patient Name: Anubhav Anand Date : 2026-09-08
SR. PRODUCT NAME MFR. Name BATCH NO. EXP. QTY Original Revised DISC TAXABLE HSN GST RATE GST AMT. TOTAL
DATE MRP MRP* AMT. (₹) AMT. (₹) (%) (₹) AMT. (₹)
1 Finastox 1mg Tablet - 10 Zeelab Pharmacy Pvt 426-336 07/28 10 10.0 10.0 0.00 95.24 30049099 5 4.76 100
Ltd
2 Dolo 650 Tablet - 15 Micro Labs Ltd DOBS4485 04/30 1 32.28 32.13 1.38 29.29 30049099 5 1.46 30.75
3 Dr. Morepen Burnol Antiseptic Dr. Morepen Limited 2604007A 03/28 1 101.0 101.0 20.20 76.95 30049099 5 3.85 80.8
& Germ Control Cream | Fights
Infections - 25gm
4 Handling Charges - OTH 1 0.00 6.92 998549 5 0.35 7.27`;

    const page2Text = `TOTAL QUANTITY: 12
GROSS AMOUNT: ₹233.13
SHIPPING & VAS ₹7.27 CHARGES:
DISCOUNT ₹21.58 AMOUNT:
BILL AMOUNT: ₹218.82
PAYABLE AMOUNT: ₹218.82`;

    const rawResult: ParsedPdfResult = {
      metadata: { numPages: 2 },
      pages: [
        { pageNumber: 1, tables: [], textBlocks: [], text: page1Text },
        { pageNumber: 2, tables: [], textBlocks: [], text: page2Text },
      ],
      tables: [],
      text: `${page1Text}\n\n${page2Text}`,
    };

    const parsed = parseInvoiceData(rawResult);
    assert.equal(parsed.invoiceFrom, "Tata 1mg");
    assert.equal(parsed.invoiceNumber, "C020692601314300");
    assert.equal(parsed.totalAmount, 218.82);
    assert.equal(parsed.finalTotalAmount, 218.82);
    assert.equal(parsed.items.length, 4);
    assert.equal(parsed.items[0].itemName, "Finastox 1mg Tablet - 10");
    assert.equal(parsed.items[0].Quantity, "10");
    assert.equal(parsed.items[0].value, 100);
    assert.equal(parsed.items[1].itemName, "Dolo 650 Tablet - 15");
    assert.equal(parsed.items[1].value, 30.75);
    assert.equal(
      parsed.items[2].itemName,
      "Dr. Morepen Burnol Antiseptic & Germ Control Cream | Fights Infections - 25gm",
    );
    assert.equal(parsed.items[2].value, 80.8);
    assert.equal(parsed.items[3].itemName, "Handling Charges - OTH");
    assert.equal(parsed.items[3].value, 7.27);
  });
});

test("Flipkart Invoice Parser", async (t) => {
  await t.test("parses multi-page Flipkart Grocery/Minutes invoices and excludes zero Handling Fee rows", () => {
    const page1Text = `Tax Invoice
Sold By: CIGFIL Limited ,
Invoice Number # LIAAE1D270063740
Order ID: OD339264204788511500
Invoice Date: 27-11-2026
Total items: 2
Product Title Qty Gross Discounts Taxable SGST CGST Total ₹
Paste & Purees Catch Ginger Garlic Paste 2 74.00 0.00 70.48 1.76 1.76 74.00
FSN: PAPFNXEYZYQGHWTA SGST/UTGST: 2.5 %
HSN/SAC: 21039090 CGST: 2.5 %
Handling Fee 2 6.00 -6.00 0.00 0.00 0.00 0.00
Chocolates Cadbury Dairy Milk 1 20.00 0.00 19.04 0.48 0.48 20.00
FSN: Chocolate Bar
CHCEWXEHQJDGFCNJ SGST/UTGST: 2.5 %
HSN/SAC: 18063200 CGST: 2.5 %
Handling Fee 1 6.00 -6.00 0.00 0.00 0.00 0.00
Total 3 106.00 -12.00 89.52 2.24 2.24 94.00
Grand Total ₹ 94.00`;

    const page2Text = `Tax Invoice
Sold By: CIGFIL RETAIL PRIVATE LIMITED ,
Invoice Number # LIAP276270027509
Order ID: OD339264204788511500
Invoice Date: 27-11-2026
Total items: 3
Product Title Qty Gross Discounts Taxable SGST CGST Total ₹
Fresh Vegetable Hybrid Tomato 1 22.00 -3.00 19.00 0.00 0.00 19.00
FSN: VEGGE5XZ6YVPFZ9V SGST/UTGST: 0.0 %
HSN/SAC: 07069030 CGST: 0.0 %
Handling Fee 1 6.00 -6.00 0.00 0.00 0.00 0.00
Fresh Vegetable New Crop Potato 1 70.00 -7.00 63.00 0.00 0.00 63.00
Handling Fee 1 6.00 -6.00 0.00 0.00 0.00 0.00
Fresh Vegetable New Crop Potato 1 25.00 -3.00 22.00 0.00 0.00 22.00
Handling Fee 1 6.00 -6.00 0.00 0.00 0.00 0.00
Total 3 135.00 -31.00 104.00 0.00 0.00 104.00
Grand Total ₹ 104.00`;

    const rawResult: ParsedPdfResult = {
      metadata: { numPages: 2 },
      pages: [
        { pageNumber: 1, tables: [], textBlocks: [], text: page1Text },
        { pageNumber: 2, tables: [], textBlocks: [], text: page2Text },
      ],
      tables: [],
      text: `${page1Text}\n\n${page2Text}`,
    };

    const parsed = parseInvoiceData(rawResult);
    assert.equal(parsed.invoiceFrom, "Flipkart");
    assert.equal(parsed.invoiceNumber, "LIAAE1D270063740, LIAP276270027509");
    const d = new Date(parsed.invoiceDate);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 10);
    assert.equal(d.getDate(), 27);

    assert.equal(parsed.totalAmount, 198);
    assert.equal(parsed.finalTotalAmount, 198);
    assert.equal(parsed.items.length, 5);
    assert.equal(parsed.items[0].itemName, "Catch Ginger Garlic Paste");
    assert.equal(parsed.items[0].Quantity, "2");
    assert.equal(parsed.items[0].value, 74);
    assert.equal(parsed.items[1].itemName, "Cadbury Dairy Milk Chocolate Bar");
    assert.equal(parsed.items[1].Quantity, "1");
    assert.equal(parsed.items[1].value, 20);
    assert.equal(parsed.items[2].itemName, "Hybrid Tomato");
    assert.equal(parsed.items[2].value, 19);
    assert.equal(parsed.items[3].itemName, "New Crop Potato");
    assert.equal(parsed.items[3].value, 63);
    assert.equal(parsed.items[4].itemName, "New Crop Potato");
    assert.equal(parsed.items[4].value, 22);
  });
});

test("Blinkit Blink Commerce UPC & Annexure Parser", async (t) => {
  await t.test("parses Blink Commerce invoice with dd-MMM-yyyy date, delivery sub-rows, and Annexure table", () => {
    const rawText = `Tax Invoice
Sold By / Seller
BLINK COMMERCE PRIVATE LIMITED
Invoice Number : C17179T250334918
Order Id : 1819649248
Name : Anubhav Anand Invoice : 03-Mar-2026
Date
Sr. no UPC Item Description MRP Discount Qty. Taxable Value CGST (%) CGST (INR) SGST (%) SGST (INR) Cess (%) Additional Cess Val Total
1 890 Royal Gulab 375.00 190.00 1 176.19 2.50 4.40 2.50 4.40 0.00 0.00 185.00
141 Jamun by
403 Bikano(Tin) (HSN-
977 21069099)
3
- Delivery and other - - - 2.69 2.50 0.07 2.50 0.07 0 0.00 2.82
charges
2 890 Dhara Lite N Fine 180.00 37.00 1 136.19 2.50 3.40 2.50 3.40 0.00 0.00 143.00
600 Refined Soyabean
462 Oil(Pouch) (HSN-
055 15079010)
3
- Delivery and other - - - 2.08 2.50 0.05 2.50 0.05 0 0.00 2.18
charges
Total 2 7.92 7.92 333.00
Annexure
S.No. Nature of charge Tax Rate Cess Rate Taxable Value CGST SGST Cess
1 Handling charge 5.00 0.00 4.762 0.119 0.119 0.000
Total 4.762 0.119 0.119 0.000`;

    const rawResult: ParsedPdfResult = {
      metadata: { numPages: 1 },
      pages: [{ pageNumber: 1, tables: [], textBlocks: [], text: rawText }],
      tables: [],
      text: rawText,
    };

    const parsed = parseInvoiceData(rawResult);
    assert.equal(parsed.invoiceFrom, "Blinkit");
    assert.equal(parsed.invoiceNumber, "C17179T250334918");
    const d = new Date(parsed.invoiceDate);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 2); // Mar
    assert.equal(d.getDate(), 3);

    assert.equal(parsed.totalAmount, 328);
    assert.equal(parsed.finalTotalAmount, 333);
    assert.equal(parsed.items.length, 2);
    assert.equal(parsed.items[0].itemName, "Royal Gulab Jamun by Bikano(Tin)");
    assert.equal(parsed.items[0].Quantity, "1");
    assert.equal(parsed.items[0].value, 185);
    assert.equal(
      parsed.items[1].itemName,
      "Dhara Lite N Fine Refined Soyabean Oil(Pouch)",
    );
    assert.equal(parsed.items[1].Quantity, "1");
    assert.equal(parsed.items[1].value, 143);
  });
});

test("Amazon Multi-Seller Invoice Parser", async (t) => {
  await t.test("parses multi-seller Amazon PDF with split CGST/SGST rows and TOTAL lines", () => {
    const page1Text = `Tax Invoice/Bill of Supply/Cash Memo
Sold By : Amazon Retail India Private Limited
Order Number: 407-5839727-7726707 Invoice Number : TND6-18787
Order Date: 19.05.2026 Invoice Date : 19.05.2026
Sl. Unit Net Tax Tax Tax Total
Description Qty
No Price Amount Rate Type Amount Amount
1 Fortune Soya Chunks, 15x more protein than milk, 1kg (Item weight
may vary) | B019Z85FYI ( B019Z85FYI ) ₹106.66 1 ₹106.66 2.5% CGST ₹2.67 ₹112.00
HSN:21069099
2.5% SGST ₹2.67
2 MAGGI 2-Minute Instant Noodles, 140g/150g Pouch | B01FRZ3DGA ( B01FRZ3DGA ₹26.66 2 ₹53.32 2.5% CGST ₹1.34 ₹56.00
)
HSN:19023010
2.5% SGST ₹1.34
3 Mother Dairy Classic Curd Polypack Pouch, 400 g | B06XWXXNKG (
B06XWXXNKG ) ₹33.34 1 ₹33.34 2.5% CGST ₹0.83 ₹35.00
HSN:04061000
2.5% SGST ₹0.83
TOTAL: ₹9.68 ₹203.00`;

    const page3Text = `Tax Invoice/Bill of Supply/Cash Memo
Sold By : Clicktech Retail Private Limited
Order Number: 407-5839727-7726707 Invoice Number : TND6-1976
Invoice Date : 19.05.2026
Sl. Unit Net Tax Tax Tax Total
Description Qty
No Price Amount Rate Type Amount Amount
1 Glun Weight Machine for Kitchen
₹207.62 1 ₹207.62 9% CGST ₹18.69 ₹245.00
with capacity 10Kg with back light | B09185QH3C ( B09185QH3C )
HSN:82055990
9% SGST ₹18.69
TOTAL: ₹37.38 ₹245.00`;

    const rawResult: ParsedPdfResult = {
      metadata: { numPages: 2 },
      pages: [
        { pageNumber: 1, tables: [], textBlocks: [], text: page1Text },
        { pageNumber: 2, tables: [], textBlocks: [], text: page3Text },
      ],
      tables: [],
      text: `${page1Text}\n\n${page3Text}`,
    };

    const parsed = parseInvoiceData(rawResult);
    assert.equal(parsed.invoiceFrom, "Amazon");
    assert.equal(parsed.invoiceNumber, "TND6-18787, TND6-1976");
    const d = new Date(parsed.invoiceDate);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 4); // May
    assert.equal(d.getDate(), 19);

    assert.equal(parsed.totalAmount, 448);
    assert.equal(parsed.finalTotalAmount, 448);
    assert.equal(parsed.items.length, 4);
    assert.equal(
      parsed.items[0].itemName,
      "Fortune Soya Chunks, 15x more protein than milk, 1kg (Item weight may vary)",
    );
    assert.equal(parsed.items[0].Quantity, "1");
    assert.equal(parsed.items[0].value, 112);
    assert.equal(parsed.items[1].Quantity, "2");
    assert.equal(parsed.items[1].value, 56);
    assert.equal(
      parsed.items[2].itemName,
      "Mother Dairy Classic Curd Polypack Pouch, 400 g",
    );
    assert.equal(parsed.items[2].value, 35);
    assert.equal(
      parsed.items[3].itemName,
      "Glun Weight Machine for Kitchen with capacity 10Kg with back light",
    );
    assert.equal(parsed.items[3].value, 245);
  });
});

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

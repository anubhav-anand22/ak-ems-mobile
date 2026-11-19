import test from "node:test";
import assert from "node:assert/strict";
import { reconstructStructure } from "../src/lib/pdfParser/reconstructStructure";
import { RawPdfPage, RawPdfTextItem } from "../src/lib/pdfParser/types";

test("PDF Structure Reconstruction - Fallback & Corrupted Inputs", async (t) => {
  await t.test("returns {} for null or undefined input", () => {
    assert.deepEqual(reconstructStructure(null), {});
    assert.deepEqual(reconstructStructure(undefined), {});
  });

  await t.test("returns {} for empty array", () => {
    assert.deepEqual(reconstructStructure([]), {});
  });

  await t.test("handles pages with zero items gracefully without crashing", () => {
    const result = reconstructStructure([{ pageNumber: 1, items: [] }]);
    assert.ok(result.metadata);
    assert.equal(result.metadata.numPages, 1);
    assert.equal(result.tables?.length, 0);
    assert.equal(result.pages?.length, 1);
    assert.equal(result.text, "");
  });

  await t.test("handles malformed or corrupted item objects without throwing", () => {
    const malformedPages = [
      {
        pageNumber: 1,
        items: [
          null as any,
          { str: "", x: NaN, y: NaN, width: 0, height: 0 } as any,
          { str: "   ", x: 10, y: 100, width: 10, height: 10 },
        ],
      },
    ];
    const result = reconstructStructure(malformedPages);
    assert.ok(result);
    assert.equal(result.tables?.length, 0);
  });
});

test("PDF Structure Reconstruction - Reading Order Preservation", async (t) => {
  await t.test("preserves top-to-bottom (Y descending) and left-to-right (X ascending) order", () => {
    // In PDF coordinates, higher Y is closer to the top of the page.
    const items: RawPdfTextItem[] = [
      // Line 2 (Y = 700): "Second Line Right" (X = 200), "Second Line Left" (X = 50)
      { str: "Second Line Right", x: 200, y: 700, width: 100, height: 12 },
      { str: "Second Line Left", x: 50, y: 700, width: 100, height: 12 },
      // Line 1 (Y = 750): "First Line Left" (X = 50), "First Line Right" (X = 200)
      { str: "First Line Right", x: 200, y: 750, width: 90, height: 12 },
      { str: "First Line Left", x: 50, y: 750, width: 80, height: 12 },
      // Line 3 (Y = 650): "Third Line" (X = 50)
      { str: "Third Line", x: 50, y: 650, width: 120, height: 12 },
    ];

    const result = reconstructStructure([{ pageNumber: 1, items }]);
    assert.ok(result.pages && result.pages[0]);
    const lines = result.pages[0].text.split("\n");

    assert.equal(lines[0], "First Line Left First Line Right");
    assert.equal(lines[1], "Second Line Left Second Line Right");
    assert.equal(lines[2], "Third Line");
  });
});

test("PDF Structure Reconstruction - Multi-Line Cells Inside Table", async (t) => {
  await t.test("merges multi-line cell lines in strict top-to-bottom order into a single cell", () => {
    // Simulate an invoice table:
    // Header (Y=500): Description (X=50), Qty (X=250), Price (X=350), Total (X=450)
    // Row 1 Line 1 (Y=480): "Organic Whole Milk" (X=50), "2" (X=250), "$3.50" (X=350), "$7.00" (X=450)
    // Row 1 Line 2 (Y=470): "(Pasteurized, 1 Gallon)" (X=50) -> Wrapped line for Description!
    // Row 1 Line 3 (Y=460): "Grade A Fresh" (X=50) -> Another wrapped line for Description!
    // Row 2 (Y=440): "Apples" (X=50), "5" (X=250), "$1.00" (X=350), "$5.00" (X=450)
    const items: RawPdfTextItem[] = [
      // Header
      { str: "Description", x: 50, y: 500, width: 80, height: 10 },
      { str: "Qty", x: 250, y: 500, width: 30, height: 10 },
      { str: "Price", x: 350, y: 500, width: 40, height: 10 },
      { str: "Total", x: 450, y: 500, width: 40, height: 10 },

      // Row 1 primary
      { str: "Organic Whole Milk", x: 50, y: 480, width: 110, height: 10 },
      { str: "2", x: 250, y: 480, width: 10, height: 10 },
      { str: "$3.50", x: 350, y: 480, width: 35, height: 10 },
      { str: "$7.00", x: 450, y: 480, width: 35, height: 10 },

      // Row 1 wrapped cell line 1
      { str: "(Pasteurized, 1 Gallon)", x: 50, y: 470, width: 120, height: 10 },

      // Row 1 wrapped cell line 2
      { str: "Grade A Fresh", x: 50, y: 460, width: 80, height: 10 },

      // Row 2 primary
      { str: "Apples", x: 50, y: 440, width: 40, height: 10 },
      { str: "5", x: 250, y: 440, width: 10, height: 10 },
      { str: "$1.00", x: 350, y: 440, width: 35, height: 10 },
      { str: "$5.00", x: 450, y: 440, width: 35, height: 10 },
    ];

    const result = reconstructStructure([{ pageNumber: 1, items }]);
    assert.ok(result.tables);
    assert.equal(result.tables.length, 1);

    const table = result.tables[0];
    assert.deepEqual(table.headers, ["Description", "Qty", "Price", "Total"]);
    assert.equal(table.rowCount, 2);

    // Verify multi-line cell merged properly
    const row1Desc = table.rows[0][0];
    assert.equal(
      row1Desc,
      "Organic Whole Milk\n(Pasteurized, 1 Gallon)\nGrade A Fresh",
    );
    assert.equal(table.rows[0][1], "2");
    assert.equal(table.rows[0][2], "$3.50");
    assert.equal(table.rows[0][3], "$7.00");

    // Verify row 2 is intact
    assert.equal(table.rows[1][0], "Apples");
    assert.equal(table.rows[1][1], "5");
    assert.equal(table.rows[1][2], "$1.00");
    assert.equal(table.rows[1][3], "$5.00");

    // Verify key-value data records
    assert.equal(
      table.data[0]["Description"],
      "Organic Whole Milk\n(Pasteurized, 1 Gallon)\nGrade A Fresh",
    );
    assert.equal(table.data[0]["Qty"], "2");
    assert.equal(table.data[1]["Description"], "Apples");
    assert.equal(table.data[1]["Qty"], "5");
  });
});

test("PDF Structure Reconstruction - Multiple Distinct Tables on One Page", async (t) => {
  await t.test("detects distinct tables separated by text paragraphs or large vertical gaps", () => {
    const items: RawPdfTextItem[] = [
      // Table 1: Items (Y: 700 - 660)
      { str: "Item", x: 40, y: 700, width: 40, height: 10 },
      { str: "Amount", x: 200, y: 700, width: 50, height: 10 },
      { str: "Coffee", x: 40, y: 680, width: 40, height: 10 },
      { str: "$4.00", x: 200, y: 680, width: 35, height: 10 },
      { str: "Tea", x: 40, y: 660, width: 30, height: 10 },
      { str: "$3.00", x: 200, y: 660, width: 35, height: 10 },

      // Intervening paragraph text (Y: 550) - Large vertical gap > 100 pt
      {
        str: "Payment Terms: Net 30 days from invoice date.",
        x: 40,
        y: 550,
        width: 250,
        height: 10,
      },

      // Table 2: Tax Summary (Y: 450 - 410)
      { str: "Tax Type", x: 60, y: 450, width: 60, height: 10 },
      { str: "Rate", x: 180, y: 450, width: 40, height: 10 },
      { str: "Tax", x: 300, y: 450, width: 30, height: 10 },
      { str: "State Tax", x: 60, y: 430, width: 60, height: 10 },
      { str: "5%", x: 180, y: 430, width: 20, height: 10 },
      { str: "$0.35", x: 300, y: 430, width: 30, height: 10 },
      { str: "City Tax", x: 60, y: 410, width: 50, height: 10 },
      { str: "2%", x: 180, y: 410, width: 20, height: 10 },
      { str: "$0.14", x: 300, y: 410, width: 30, height: 10 },
    ];

    const result = reconstructStructure([{ pageNumber: 1, items }]);
    assert.ok(result.tables);
    assert.equal(result.tables.length, 2);

    // Table 1
    const t1 = result.tables[0];
    assert.deepEqual(t1.headers, ["Item", "Amount"]);
    assert.equal(t1.rowCount, 2);
    assert.equal(t1.data[0]["Item"], "Coffee");
    assert.equal(t1.data[0]["Amount"], "$4.00");

    // Table 2
    const t2 = result.tables[1];
    assert.deepEqual(t2.headers, ["Tax Type", "Rate", "Tax"]);
    assert.equal(t2.rowCount, 2);
    assert.equal(t2.data[0]["Tax Type"], "State Tax");
    assert.equal(t2.data[0]["Rate"], "5%");
    assert.equal(t2.data[0]["Tax"], "$0.35");

    // Check textBlocks for the intervening paragraph
    assert.ok(result.pages && result.pages[0]);
    const blockTexts = result.pages[0].textBlocks.map((b) => b.text);
    assert.ok(
      blockTexts.some((txt) =>
        txt.includes("Payment Terms: Net 30 days from invoice date."),
      ),
    );
  });
});

test("PDF Structure Reconstruction - Multi-Page Processing", async (t) => {
  await t.test("aggregates multiple pages preserving document order", () => {
    const page1: RawPdfPage = {
      pageNumber: 1,
      items: [
        { str: "Page 1 Header", x: 50, y: 800, width: 100, height: 12 },
        { str: "Col A", x: 50, y: 700, width: 40, height: 10 },
        { str: "Col B", x: 200, y: 700, width: 40, height: 10 },
        { str: "Val 1", x: 50, y: 680, width: 30, height: 10 },
        { str: "Val 2", x: 200, y: 680, width: 30, height: 10 },
      ],
    };

    const page2: RawPdfPage = {
      pageNumber: 2,
      items: [
        { str: "Page 2 Header", x: 50, y: 800, width: 100, height: 12 },
        { str: "Col C", x: 50, y: 700, width: 40, height: 10 },
        { str: "Col D", x: 200, y: 700, width: 40, height: 10 },
        { str: "Val 3", x: 50, y: 680, width: 30, height: 10 },
        { str: "Val 4", x: 200, y: 680, width: 30, height: 10 },
      ],
    };

    const result = reconstructStructure([page1, page2]);
    assert.equal(result.metadata?.numPages, 2);
    assert.equal(result.pages?.length, 2);
    assert.equal(result.tables?.length, 2);
    assert.ok(result.text?.includes("Page 1 Header"));
    assert.ok(result.text?.includes("Page 2 Header"));
  });
});

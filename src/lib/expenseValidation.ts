import { parseStrMath } from "./parseStrMath";

export type ExpenseAmountItem = {
  id: number;
  title: string;
  amount: number;
};

export type ResolveAmountItemsResult =
  | {
      ok: true;
      items: ExpenseAmountItem[];
      addedFromInputs: boolean;
      totalAmount: number;
    }
  | {
      ok: false;
      amountErr: string;
      titleErr: string;
      warningMessage: string;
    };

/**
 * Resolves and validates expense amount items for submission.
 * - When `amountArr` is empty, checks that both amount and title are filled,
 *   evaluates the math expression, and returns the created item list.
 * - Fails with field errors and a warning message if required inputs are missing,
 *   invalid, or the resulting total amount equals 0.
 */
export function resolveAmountItemsForSubmit(params: {
  amountArr: ExpenseAmountItem[];
  amountTxt: string;
  amountTitleTxt: string;
}): ResolveAmountItemsResult {
  const { amountArr, amountTxt, amountTitleTxt } = params;
  const trimmedAmount = amountTxt.trim();
  const trimmedTitle = amountTitleTxt.trim();

  let items = amountArr;
  let addedFromInputs = false;

  if (amountArr.length === 0) {
    if (trimmedAmount === "" || trimmedTitle === "") {
      const amountErr = trimmedAmount === "" ? "Amount is required" : "";
      const titleErr = trimmedTitle === "" ? "Amount title is required" : "";
      let warningMessage = "Please enter amount and amount title";
      if (trimmedAmount === "" && trimmedTitle !== "") {
        warningMessage = "Please enter an amount";
      } else if (trimmedAmount !== "" && trimmedTitle === "") {
        warningMessage = "Please enter an amount title";
      }
      return {
        ok: false,
        amountErr,
        titleErr,
        warningMessage,
      };
    }

    const [parsed, err] = parseStrMath(trimmedAmount);
    if (
      err ||
      parsed === null ||
      typeof parsed !== "number" ||
      !Number.isFinite(parsed)
    ) {
      return {
        ok: false,
        amountErr: "Invalid amount",
        titleErr: "",
        warningMessage: "Please enter a valid amount",
      };
    }

    const roundedAmount = Math.round(parsed * 100) / 100;
    if (roundedAmount === 0) {
      return {
        ok: false,
        amountErr: "Amount cannot be 0",
        titleErr: "",
        warningMessage: "Total amount cannot be 0",
      };
    }

    items = [
      {
        id: Math.random(),
        title: trimmedTitle,
        amount: parsed,
      },
    ];
    addedFromInputs = true;
  }

  const totalSum = items.reduce(
    (acc, curr) => acc + (Number(curr.amount) || 0),
    0,
  );
  const totalAmount = Math.round(totalSum * 100) / 100;

  if (totalAmount === 0) {
    return {
      ok: false,
      amountErr: "Total amount cannot be 0",
      titleErr: "",
      warningMessage: "Total amount cannot be 0",
    };
  }

  return {
    ok: true,
    items,
    addedFromInputs,
    totalAmount,
  };
}

const ExpenseObj = {
  "Simple Expense": ["Send", "Receive"],
  Credit: ["Borrow", "Lend"],
} as const;

export type ExpenseType = keyof typeof ExpenseObj;
export type SubExpenseType =
  (typeof ExpenseObj)[keyof typeof ExpenseObj][number];

const ExpenseArr = Object.keys(ExpenseObj) as ExpenseType[];
const SubExpenseArr = Object.values(ExpenseObj).flat() as SubExpenseType[];

export const Expense = {
  ExpenseArr,
  SubExpenseArr,
  ExpenseObj,
};

export type InterestType = "Simple" | "Compound" | "None";
export const InterestArr: InterestType[] = ["None", "Simple", "Compound"];
export const CompoundingFrequencyObj = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Quarterly", value: "quarterly" },
  { label: "Semi-annual", value: "semiannual" },
  { label: "Yearly", value: "yearly" },
] as const;
export type CompoundingFrequency = (typeof CompoundingFrequencyObj)[number]["value"];

import { TransactionType } from "@/db/schema";
import { getCompoundingFreqAsNum } from "./getCompoundingFreqAsNum";

export const getTotalAmountWithExtraData = (item: TransactionType) => {
  // const creditAmount = switch(item.int)
  const principal = item.amount.reduce((acc, curr) => acc + curr.amount, 0);
  let interestAmount = 0;
  if (item.expenseType === "Credit") {
    const rate = (item.interestRate ?? 0) / 100;
    const time = item.interestTime ?? 1;
    const simpleInterest = principal * rate * time;
    switch (item.interestType) {
      case "Compound": {
        const n = getCompoundingFreqAsNum(
          item.compoundingFrequency ?? "yearly",
        );
        const compoundTotal = principal * Math.pow(1 + rate / n, n * time);
        const compoundInterest = compoundTotal - principal;
        interestAmount = compoundInterest;
        break;
      }
      case "Simple":
        interestAmount = simpleInterest;
        break;
      default:
        interestAmount = 0;
    }
  }
  // return Number(.(interestAmount + principal));
  return {
    totalAmount: Number((interestAmount + principal).toFixed(2)),
    interestAmount: Number(interestAmount.toFixed(2)),
    principal: Number(principal.toFixed(2)),
    interestType: item.interestType,
  };
  // return ;
};

export const getTotalAmount = (item: TransactionType) => {
  return getTotalAmountWithExtraData(item).totalAmount;
};

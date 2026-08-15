export const getCompoundingFreqAsNum = (freq: string) => {
  let n = 1; // Default to yearly if null or undefined
  switch (freq) {
    case "daily":
      n = 365;
      break;
    case "weekly":
      n = 52;
      break;
    case "monthly":
      n = 12;
      break;
    case "quarterly":
      n = 4;
      break;
    case "semiannual":
      n = 2;
      break;
    case "yearly":
      n = 1;
      break;
  }
  return n;
};

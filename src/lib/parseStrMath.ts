import { Parser } from "expr-eval";

export const parseStrMath = (str: string): [number, null] | [null, Error] => {
  try {
    const parser = new Parser();
    const expr = parser.parse(str);
    const result = expr.evaluate();
    return [result, null];
  } catch (error) {
    return [null, error as Error];
  }
};

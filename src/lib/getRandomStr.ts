const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890"

export const getRandomStr = (len: number = 20) => {
    let result = "";
  for (let i = 0; i < len; i++) {
    result += CHARS[(Math.random() * CHARS.length) | 0];
  }
  return result;
}
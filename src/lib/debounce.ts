const a: { [key: string]: number } = {};

export const debounce = (cb: () => void, time: number, id: string) => {
  if (a[id]) clearTimeout(a[id]);
  const timeoutId = setTimeout(() => {
    clearTimeout(a[id]);
    delete a[id];
    cb();
  }, time);
  a[id] = timeoutId;
};

const a: { [key: string]: [number, () => void] } = {};

export const waitForCondition = {
  cbLastCallBack: (
    checkingCb: () => boolean,
    cb: () => void,
    id: string,
    checkingInterval = 300,
  ) => {
    if (a[id]) clearInterval(a[id][0]);

    a[id] = [
      setInterval(() => {
        if (checkingCb()) {
          clearInterval(a[id][0]);
          a[id][1]();
          delete a[id]
        }
      }, checkingInterval),
      cb,
    ];
  },
  cb: (checkingCb: () => boolean, cb: () => void, checkingInterval = 300) => {
    const id = setInterval(() => {
      if (checkingCb()) {
        clearInterval(id);
        cb();
      }
    }, checkingInterval);
  },
  promise: (checkingCb: () => boolean, checkingInterval = 300) => {
    return new Promise((r) => {
      const id = setInterval(() => {
        if (checkingCb()) {
          clearInterval(id);
          r(0);
        }
      }, checkingInterval);
    });
  },
  cbAndPromise: (
    checkingCb: () => boolean,
    cb?: () => void,
    checkingInterval = 300,
  ) => {
    return new Promise((r) => {
      const id = setInterval(() => {
        if (checkingCb()) {
          clearInterval(id);
          if (cb) cb();
          r(0);
        }
      }, checkingInterval);
    });
  },
};

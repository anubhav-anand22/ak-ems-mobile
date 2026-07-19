export function formatSmartDate(date: Date, locale = "en-IN") {
  const now = new Date();

  // Remove time portion
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / 86400000
  );

  const time = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .replace(/\s/g, "")
    .toLowerCase();

  if (diffDays === 0) {
    return `today, ${time}`;
  }

  if (diffDays === -1) {
    return `yesterday, ${time}`;
  }

  const day = ordinal(date.getDate());

  if (date.getFullYear() === now.getFullYear()) {
    const month = new Intl.DateTimeFormat(locale, {
      month: "short",
    })
      .format(date)
      .toLowerCase();

    return `${day} ${month}, ${time}`;
  }

  const month = new Intl.DateTimeFormat(locale, {
    month: "short",
  })
    .format(date)
    .toLowerCase();

  return `${day} ${month} ${date.getFullYear()}, ${time}`;
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

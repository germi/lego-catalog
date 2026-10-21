export function number(
  val,
  round = 1,
  {
    abbr = false,
    decimal = ",",
    thousand = ".",
    trimZeros = false, // remove trailing zero
    minSig = false, // minimum number of significant digits
  } = {},
) {
  if (typeof val !== "number" || isNaN(val)) return "---";
  // if (isNaN(val) || val === null) return "---";

  let value = val;
  let suffix = "";

  if (abbr) {
    // MILIONS
    if (val >= 1_000_000) {
      value = val / 1_000_000;
      // 0 decimals for multiples of 1M
      round = val % 1_000_000 ? round : 0;
      suffix = "M";
    }
    // Ks
    else if (val >= 1000) {
      value = val / 1000;
      // 0 decimals for multiples of 1K
      round = val % 1000 ? round : 0;
      suffix = "k";
    }
  }

  let formatted;

  // Show at least one significant digit for values between -1 and 1
  if (minSig && Math.abs(value) < 1 && value !== 0) {
    // For small numbers, only replace decimal separator
    // we don't need to add thousand separators
    formatted = value.toPrecision(Math.max(1, round)).replace(".", decimal);
  } else {
    formatted = value
      .toFixed(round)
      .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1;")
      .replace(/\./, decimal)
      .replace(/;/g, thousand);
  }

  // Remove trailing zeros and decimal if not needed
  if (
    trimZeros &&
    formatted.includes(decimal) &&
    (!minSig || Math.abs(value) >= 1 || value === 0)
  ) {
    const regex = new RegExp(`(${decimal}\\d*?)0+$`);
    formatted = formatted.replace(regex, "$1");

    if (formatted.endsWith(decimal)) formatted = formatted.slice(0, -1);
  }

  return formatted + suffix;
}

const accentsMap = {
  a: "á|à|ã|â|À|Á|Ã|Â",
  e: "é|è|ê|É|È|Ê",
  i: "í|ì|î|Í|Ì|Î",
  o: "ó|ò|ô|õ|Ó|Ò|Ô|Õ",
  u: "ú|ù|û|ü|Ú|Ù|Û|Ü",
  c: "ç|Ç",
  n: "ñ|Ñ",
};

export const slugify = (text) =>
  Object.keys(accentsMap)
    .reduce(
      (acc, cur) => acc.replace(new RegExp(accentsMap[cur], "g"), cur),
      text?.toLowerCase() || "",
    )
    .trim()
    .replace(/ +(?= )/g, "")
    .replace(/\s/g, "-") // replace spaces with dashes
    .replace(/[^a-z0-9-]/g, ""); // remove all non-alphanumeric characters except dashes

export function trailingZero(num) {
  return num < 10 ? "0" + num : "" + num;
}

export function urlSafe(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase();
}

export function num(num) {
  return +num.replace(",", ".");
}

export function removeNulls(data) {
  for (const key in data) {
    if (Object.hasOwnProperty.call(data, key)) {
      if (!data[key]) delete data[key];
    }
  }
  return data;
}

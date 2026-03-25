export function isValidURL(urlValue) {
  try {
    const url = new URL(urlValue);
    //return false if link doesnt have http or https
    if (!["http:", "https:"].includes(url.protocol)) {
      return false;
    }
    const hostName = url.hostname;
    //return false if the url doesnt have a .
    if (!hostName.includes(".")) {
      return false;
    }
    //return false if url starts with or ends with "."
    if (hostName.startsWith(".") || hostName.endsWith(".")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
export function normalizeURL(value) {
  let url = value.trim(); //.trim removes whitespace
  // If protocol missing, prepend https://
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}
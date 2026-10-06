function openExternalUrl(candidate, openExternal) {
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    void openExternal(candidate);
    return true;
  } catch {
    return false;
  }
}

module.exports = { openExternalUrl };

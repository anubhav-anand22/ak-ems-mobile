export const resolveApkFilename = (
  url?: string | null,
  releaseName?: string | null,
  tagName?: string | null,
): string => {
  if (url) {
    try {
      const cleanUrl = url.split("?")[0].split("#")[0];
      const segments = cleanUrl.split("/");
      const candidate = segments.pop();
      if (candidate && candidate.toLowerCase().endsWith(".apk")) {
        return candidate.replaceAll("/", "_").replaceAll("\\", "_");
      }
    } catch {}
  }

  const base =
    releaseName ||
    (tagName ? `ak-ems-mobile-${tagName}` : "ak-ems-mobile-update");
  const sanitized = base
    .trim()
    .replaceAll("/", "_")
    .replaceAll("\\", "_")
    .replaceAll(/\s+/g, "_");

  return sanitized.toLowerCase().endsWith(".apk")
    ? sanitized
    : `${sanitized}.apk`;
};

export const formatDownloadSuccessMessage = (filename: string): string =>
  `Update saved to Downloads as "${filename}".`;

export const formatDownloadFallbackMessage = (filename: string): string =>
  `APK is saved in your Downloads folder as "${filename}". Please open your File Manager to install.`;

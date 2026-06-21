/**
 * SSRF Protection: blocks literal private IP ranges (RFC 1918),
 * link-local IPs (169.254.x.x), and localhost.
 */
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

    const hostname = parsed.hostname.toLowerCase();

    // Block localhost and common local patterns
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "[::1]" ||
      hostname === "[::]" ||
      hostname.endsWith(".local")
    ) {
      return false;
    }

    // Block private IP ranges (RFC 1918) and link-local
    // 10.0.0.0/8, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16
    // Using $ to ensure it matches the full hostname if it's an IP.
    const privateIpRegex = /^(10\.|127\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/;
    const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
    if (isIp && privateIpRegex.test(hostname)) return false;

    // Block IPv6 private (fc00::/7) and link-local (fe80::/10)
    if (hostname.startsWith("[")) {
      if (hostname.startsWith("[fc") || hostname.startsWith("[fd") || /^\[fe[89ab]/i.test(hostname)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

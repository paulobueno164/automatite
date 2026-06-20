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
      hostname.endsWith(".local")
    ) {
      return false;
    }

    // Block private IP ranges (RFC 1918) and link-local
    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
    const privateIpRegex = /^(10\.|127\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/;
    if (privateIpRegex.test(hostname)) return false;

    return true;
  } catch {
    return false;
  }
}

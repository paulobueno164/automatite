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

    // Block private IP ranges (RFC 1918), carrier-grade NAT (RFC 6598), and link-local (RFC 3927)
    // 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16
    const privateIpRegex = /^(10\.|127\.|169\.254\.|100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/;
    if (privateIpRegex.test(hostname)) return false;

    // IPv6 Unicast-Local (fc00::/7) and Link-Local (fe80::/10)
    if (hostname.startsWith("[fc") || hostname.startsWith("[fd") || hostname.startsWith("[fe8")) return false;

    return true;
  } catch {
    return false;
  }
}

## 2025-05-14 - SSRF Protection in Automation Engine
**Vulnerability:** Server-Side Request Forgery (SSRF) in `http_request` and `analyze_image` actions.
**Learning:** These actions were fetching arbitrary URLs provided by users without validation, potentially allowing access to internal metadata services, private networks, or localhost.
**Prevention:** Use a central `isSafeUrl` utility to block private IP ranges (RFC 1918), link-local IPs, and localhost before any outbound server-side fetch.

## 2025-06-21 - Robust SSRF Validation
**Vulnerability:** Potential SSRF bypasses via IPv6 and false positives in hostname validation.
**Learning:** Naive string-based IP checks (like `hostname.startsWith('127.')`) can cause false positives for legitimate subdomains (e.g., `127.0.0.1.example.com`). Also, IPv6 local/private ranges (fc00::/7, fe80::/10) must be explicitly blocked.
**Prevention:** Verify if a hostname is a literal IP address before applying range-based regex checks, and explicitly include IPv6 local address patterns in the blocklist.

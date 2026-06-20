## 2025-05-14 - SSRF Protection in Automation Engine
**Vulnerability:** Server-Side Request Forgery (SSRF) in `http_request` and `analyze_image` actions.
**Learning:** These actions were fetching arbitrary URLs provided by users without validation, potentially allowing access to internal metadata services, private networks, or localhost.
**Prevention:** Use a central `isSafeUrl` utility to block private IP ranges (RFC 1918), link-local IPs, and localhost before any outbound server-side fetch.

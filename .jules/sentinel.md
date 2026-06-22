## 2025-05-14 - SSRF Protection in Automation Engine
**Vulnerability:** Server-Side Request Forgery (SSRF) in `http_request` and `analyze_image` actions.
**Learning:** These actions were fetching arbitrary URLs provided by users without validation, potentially allowing access to internal metadata services, private networks, or localhost.
**Prevention:** Use a central `isSafeUrl` utility to block private IP ranges (RFC 1918), link-local IPs, and localhost before any outbound server-side fetch.

## 2025-05-15 - XSS in Server-Side Rendered HTML
**Vulnerability:** Cross-Site Scripting (XSS) in `/api/approve` via automation name and resume token.
**Learning:** Routes returning raw `NextResponse` with HTML strings and template literals bypass standard React auto-escaping, requiring manual sanitization of all dynamic inputs.
**Prevention:** Always use `escapeHtml` when interpolating user-controlled data into raw HTML strings.

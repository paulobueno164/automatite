## 2025-05-14 - SSRF Protection in Automation Engine
**Vulnerability:** Server-Side Request Forgery (SSRF) in `http_request` and `analyze_image` actions.
**Learning:** These actions were fetching arbitrary URLs provided by users without validation, potentially allowing access to internal metadata services, private networks, or localhost.
**Prevention:** Use a central `isSafeUrl` utility to block private IP ranges (RFC 1918), link-local IPs, and localhost before any outbound server-side fetch.

## 2025-05-15 - XSS in Route Handler HTML Responses
**Vulnerability:** Reflected/Stored XSS in `/api/approve` via `automation.name` and `token`.
**Learning:** Next.js Route Handlers do not automatically sanitize string-based HTML responses. Data interpolated into backticks in `NextResponse` is sent raw.
**Prevention:** Always use `escapeHtml` (now exported from `@/lib/email-template`) when generating manual HTML strings in Route Handlers.

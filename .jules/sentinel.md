## 2025-05-14 - SSRF Protection in Automation Engine
**Vulnerability:** Server-Side Request Forgery (SSRF) in `http_request` and `analyze_image` actions.
**Learning:** These actions were fetching arbitrary URLs provided by users without validation, potentially allowing access to internal metadata services, private networks, or localhost.
**Prevention:** Use a central `isSafeUrl` utility to block private IP ranges (RFC 1918), link-local IPs, and localhost before any outbound server-side fetch.

## 2026-07-01 - Enhanced XSS Protection for Form Templates
**Vulnerability:** Cross-Site Scripting (XSS) via event handlers and dangerous URI schemes in custom form HTML.
**Learning:** Initial sanitization was too permissive, allowing attributes like `onclick` and schemes like `javascript:` which bypass simple tag-based filtering.
**Prevention:** Stripping dangerous tags (iframe, form, etc.), removing all `on*` attributes, and neutralizing `javascript:`/`data:` URIs in standard HTML attributes.

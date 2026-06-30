## 2025-05-14 - SSRF Protection in Automation Engine
**Vulnerability:** Server-Side Request Forgery (SSRF) in `http_request` and `analyze_image` actions.
**Learning:** These actions were fetching arbitrary URLs provided by users without validation, potentially allowing access to internal metadata services, private networks, or localhost.
**Prevention:** Use a central `isSafeUrl` utility to block private IP ranges (RFC 1918), link-local IPs, and localhost before any outbound server-side fetch.

## 2025-05-15 - XSS Vulnerability in Custom Form HTML
**Vulnerability:** Insufficient sanitization of custom HTML in `PublicForm` allowed for Cross-Site Scripting (XSS) via event handlers and URI-based payloads.
**Learning:** The initial implementation only stripped `<script>` tags, which is inadequate as browsers support many other ways to execute JS (event handlers, `javascript:` URIs, etc.).
**Prevention:** Use a robust sanitization logic (or library) that strips all `on*` attributes, dangerous tags (`iframe`, `form`, etc.), and neutralizes non-standard URI schemes in `href` and `src` attributes.

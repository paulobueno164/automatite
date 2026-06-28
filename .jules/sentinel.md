## 2025-05-14 - SSRF Protection in Automation Engine
**Vulnerability:** Server-Side Request Forgery (SSRF) in `http_request` and `analyze_image` actions.
**Learning:** These actions were fetching arbitrary URLs provided by users without validation, potentially allowing access to internal metadata services, private networks, or localhost.
**Prevention:** Use a central `isSafeUrl` utility to block private IP ranges (RFC 1918), link-local IPs, and localhost before any outbound server-side fetch.

## 2025-05-15 - XSS Vulnerability in Custom Form HTML
**Vulnerability:** Cross-Site Scripting (XSS) in public forms using `customHtml`. The previous `sanitizeFormHtml` only removed `<script>` tags, allowing event handlers (e.g., `onerror`), dangerous tags (e.g., `iframe`), and `javascript:` URIs.
**Learning:** Simple string replacement of `<script>` tags is insufficient for HTML sanitization. User-provided HTML must be stripped of all active content.
**Prevention:** Use a robust sanitization approach that removes dangerous tags (iframe, object, etc.), strips all `on*` event handler attributes, and neutralizes `javascript:` URIs.

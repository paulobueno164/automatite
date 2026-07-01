## 2025-05-14 - SSRF Protection in Automation Engine
**Vulnerability:** Server-Side Request Forgery (SSRF) in `http_request` and `analyze_image` actions.
**Learning:** These actions were fetching arbitrary URLs provided by users without validation, potentially allowing access to internal metadata services, private networks, or localhost.
**Prevention:** Use a central `isSafeUrl` utility to block private IP ranges (RFC 1918), link-local IPs, and localhost before any outbound server-side fetch.

## 2026-07-01 - SSRF Protection Enhancement
**Vulnerability/Improvement:** The `isSafeUrl` function was missing coverage for RFC 6598 (Shared Address Space) and IPv6 local ranges, potentially allowing SSRF to those ranges.
**Prevention:** Updated the regex to include 100.64.0.0/10 and added prefix checks for IPv6 Unique Local and Link-Local addresses.

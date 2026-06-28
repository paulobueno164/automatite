## 2026-06-17 - Independent feedback for multiple copy buttons
**Learning:** When a UI component contains multiple copy-to-clipboard actions (e.g., Form URL and Webhook URL), using a single boolean state for 'copied' creates confusing feedback where all buttons show 'Copied!' simultaneously. Using a union type state like `'form' | 'webhook' | null` ensures precise visual feedback for the specific action taken.
**Action:** Always use distinct or union states for transient UI feedback when multiple similar actions coexist in the same context.

## 2025-05-15 - Robust label-input associations for testing and accessibility
**Learning:** Using explicit `htmlFor` and `id` associations between labels and inputs is not just an accessibility best practice; it also enables much more robust automated testing using Playwright's `get_by_label`. Relying on implicit nesting or no association makes the UI harder to navigate for screen readers and harder to verify with tools.
**Action:** Ensure all form fields have unique IDs and corresponding `htmlFor` labels to facilitate accessible navigation and reliable automated verification.

## 2026-06-17 - Independent feedback for multiple copy buttons
**Learning:** When a UI component contains multiple copy-to-clipboard actions (e.g., Form URL and Webhook URL), using a single boolean state for 'copied' creates confusing feedback where all buttons show 'Copied!' simultaneously. Using a union type state like `'form' | 'webhook' | null` ensures precise visual feedback for the specific action taken.
**Action:** Always use distinct or union states for transient UI feedback when multiple similar actions coexist in the same context.

## 2025-05-15 - Accessibility for Floating AI Chat Components
**Learning:** Floating AI chat assistants need proper ARIA implementation to be usable by screen readers. Key elements include dynamic `aria-label` and `aria-expanded` on the toggle, `role="dialog"` and a descriptive `aria-label` on the container, and `aria-live="polite"` for asynchronous 'thinking' states.
**Action:** When implementing or updating chat components, ensure they follow the disclosure/dialog pattern and provide live feedback for processing states.

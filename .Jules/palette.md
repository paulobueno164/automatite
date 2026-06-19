## 2025-05-14 - Improved accessibility for icon-only buttons
**Learning:** Icon-only buttons and buttons using Unicode characters (↑, ↓, ⠿, →) are not accessible to screen readers without explicit ARIA labels, even if they have a `title` attribute.
**Action:** Always provide `aria-label` for buttons that don't have descriptive text, and ensure the label updates dynamically if the button's state changes.

## 2025-05-15 - Enhancing AI Chat Accessibility
**Learning:** AI chat interfaces often fail to communicate state transitions to screen reader users. Using `role="dialog"` with a clear `aria-label` for the container, and `aria-live="polite"` for "thinking" indicators, ensures the assistant's status is perceivable.
**Action:** When implementing interactive overlays or chat windows, always define the `dialog` role and use live regions for dynamic background status updates.

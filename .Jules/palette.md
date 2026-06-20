## 2025-05-14 - Improved accessibility for icon-only buttons
**Learning:** Icon-only buttons and buttons using Unicode characters (↑, ↓, ⠿, →) are not accessible to screen readers without explicit ARIA labels, even if they have a `title` attribute.
**Action:** Always provide `aria-label` for buttons that don't have descriptive text, and ensure the label updates dynamically if the button's state changes.

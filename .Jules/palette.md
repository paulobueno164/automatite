## 2025-05-15 - Dynamic ARIA labels for toggle buttons
**Learning:** Accessibility labels for toggle buttons (like an AI Assistant) should reflect the *result* of the action or the *current* state's opposite to be intuitive. A static "Open" label when the component is already open is confusing for screen reader users.
**Action:** Always use dynamic `aria-label` or `aria-expanded` for toggle components.

## 2025-05-15 - Global focus-visible states
**Learning:** The project's design system (using Tailwind and custom `.btn` classes) might omit default focus rings. This makes keyboard navigation nearly impossible as users can't see which element is active.
**Action:** Ensure the base button class in `globals.css` includes `focus-visible` styles that provide high contrast.

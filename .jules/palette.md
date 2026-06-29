## 2026-06-17 - Independent feedback for multiple copy buttons
**Learning:** When a UI component contains multiple copy-to-clipboard actions (e.g., Form URL and Webhook URL), using a single boolean state for 'copied' creates confusing feedback where all buttons show 'Copied!' simultaneously. Using a union type state like `'form' | 'webhook' | null` ensures precise visual feedback for the specific action taken.
**Action:** Always use distinct or union states for transient UI feedback when multiple similar actions coexist in the same context.

## 2025-05-22 - Standardizing Label-Input Associations
**Learning:** Forms lacking explicit label-input associations (missing `htmlFor` and `id`) degrade accessibility for screen readers and fail to provide the expected UX of focusing an input when its label is clicked. This pattern often persists in dynamic forms where IDs must be generated.
**Action:** Always ensure every form control has a unique `id` and its corresponding `<label>` uses `htmlFor` to reference it, even in dynamically generated field sets.

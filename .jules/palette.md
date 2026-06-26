## 2026-06-17 - Independent feedback for multiple copy buttons
**Learning:** When a UI component contains multiple copy-to-clipboard actions (e.g., Form URL and Webhook URL), using a single boolean state for 'copied' creates confusing feedback where all buttons show 'Copied!' simultaneously. Using a union type state like `'form' | 'webhook' | null` ensures precise visual feedback for the specific action taken.
**Action:** Always use distinct or union states for transient UI feedback when multiple similar actions coexist in the same context.
## 2026-06-26 - [Loop Action Implementation]
**Learning:**
- Implementing loops in a recursive engine requires careful context isolation for nested iterations (, ).
- Resumption of nested flows (pausing inside a loop) can be managed using dotted path notation (e.g., `actionIndex.iterationIndex.subActionIndex`).
- Dynamic loop items must be interpolated before being parsed into an array to support variables from previous steps.
- Enhanced interpolation to support nested dot-notation (e.g., `{user.address.city}`) significantly improves user flexibility.

**Action:**
- Added `loop` action to `flow-types.ts`, `action-schemas.ts`, and `actions.ts`.
- Updated `runActionSequence` in `index.ts` to handle iterations and resumption logic.
- Exported and used `interpolate` in the engine for dynamic loop item resolution.
- Updated AI Assistant prompt to enable loop generation.
## 2026-06-26 - [Loop Action Implementation]
**Learning:**
- Implementing loops in a recursive engine requires careful context isolation for nested iterations (loop_item, loop_index).
- Resumption of nested flows (pausing inside a loop) can be managed using dotted path notation (e.g., 'actionIndex.iterationIndex.subActionIndex').
- Dynamic loop items must be interpolated before being parsed into an array to support variables from previous steps.
- Enhanced interpolation to support nested dot-notation (e.g., '{user.address.city}') significantly improves user flexibility.

**Action:**
- Added 'loop' action to 'flow-types.ts', 'action-schemas.ts', and 'actions.ts'.
- Updated 'runActionSequence' in 'index.ts' to handle iterations and resumption logic.
- Exported and used 'interpolate' in the engine for dynamic loop item resolution.
- Updated AI Assistant prompt to enable loop generation.

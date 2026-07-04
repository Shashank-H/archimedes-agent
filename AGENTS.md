# Agent Instructions

## React page/component changes

- When adding tooltips/popovers/menus, use a shared component or established UI library primitive (for example Radix) instead of one-off CSS pseudo-elements or native `title` tooltips; keep tooltip styling centralized so all tooltips look consistent and theme-appropriate.
- Prefer Radix UI primitives/icons for accessible reusable UI building blocks whenever an equivalent exists (dialogs, switches, selects, popovers, tooltips, icons), then layer app-specific theming through shared wrappers/components instead of one-off UI built from scratch.
- When adding a new third-party library/package, update the in-app open source attributions list in the same change; if multiple packages come from one provider (for example `@radix-ui/*`), prefer a single provider-level attribution unless separate licenses require otherwise.
- When creating or modifying existing pages/components, prefer custom hooks for stateful and business logic.
- Keep component markup minimal: components should primarily call hooks, read returned state/actions, and render UI.
- Move request orchestration, settings decisions, derived state, side effects, and testable workflows into hooks rather than embedding them directly in component files.
- Design hooks with focused inputs/outputs so they are easier to unit test independently from the rendered component.
- Keep constants, enum-like values, reusable copy, option lists, and static instruction templates in nearby `constants.ts` files; keep pure formatting/detection helpers in `utils.ts` files.
- Avoid scattering hardcoded data, strings, route/view names, options, or mode mappings directly through components/hooks; model them as typed objects, constants, enums, lookup maps, or other extendable structures that make future additions localized and low-risk.
- Do not create bespoke or band-aid implementations just to satisfy the current two-case UI; prefer generic configuration-driven flows, derived state, and reusable actions so adding another view/mode/option does not require duplicating functions or branching throughout the code.
- Do not duplicate reusable UI primitives such as cards, accordions, dialogs, switches, headers, or icon wrappers across pages; extract shared or feature-local components instead.
- For routed workspace-style UIs, keep the persistent workspace/shell outside the router when panes should be independently controlled; route only the pane content that actually changes.
- Prefer `MemoryRouter` for internal pane navigation that should not affect browser/history URLs.
- Keep data ownership hierarchical: higher-level workspace providers should own only workspace-wide state, while feature providers (for example chat/settings) own feature-specific data and may depend on workspace context, not the reverse.
- For Radix portals, ensure app theme variables are available globally (for example on `document.documentElement`) rather than passing theme props through low-level dialog/popover components.
- When wrapping Radix primitives, style against Radix state attributes such as `data-state="checked"`/`unchecked` and preserve app-specific styling through shared wrappers.
- Links styled as buttons/actions must explicitly define normal, visited, hover, and active colors to avoid browser link-state color drift.
- Split CSS by ownership instead of continuously adding to a monolithic stylesheet: shared primitives may live in global/shared CSS, while page/feature/component-specific styles should live in nearby CSS files imported by their owner.
- When CSS for a feature grows beyond a small localized tweak or introduces a reusable component, create a dedicated stylesheet/module for that feature/component and keep selectors scoped by a clear namespace.
- Do not add new large sections to `styles.css` unless they are truly global tokens, resets, or cross-app primitives; prefer incremental migration toward smaller maintainable CSS files when touching existing feature styles.
- Always use theme tokens/CSS variables for colors in UI styles. Do not introduce hardcoded hex/rgb/rgba colors in component or feature CSS unless defining/updating the theme tokens themselves.

## Architecture rules

- Prefer class-based designs for services, factories, providers, storage, and other reusable application infrastructure.
- When a module represents a service with behavior/stateful dependencies, expose a class plus a shared instance instead of loose exported functions.
- Real call sites should use the class instance/factory directly; avoid keeping function wrappers around class methods unless there is a strong compatibility reason.
- Provider implementations must extend the abstract base provider, and provider/runtime selection must go through the class-based factory.
- Keep provider-specific connection tests and streaming behavior inside the provider class itself.
- Do not add legacy storage fallbacks or migrations unless explicitly requested; treat new storage schemas as canonical going forward.

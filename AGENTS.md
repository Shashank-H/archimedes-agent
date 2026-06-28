# Agent Instructions

## React page/component changes

- When adding tooltips/popovers/menus, use a shared component or established UI library primitive (for example Radix) instead of one-off CSS pseudo-elements or native `title` tooltips; keep tooltip styling centralized so all tooltips look consistent and theme-appropriate.
- When adding a new third-party library/package, update the in-app open source attributions list in the same change.
- When creating or modifying existing pages/components, prefer custom hooks for stateful and business logic.
- Keep component markup minimal: components should primarily call hooks, read returned state/actions, and render UI.
- Move request orchestration, settings decisions, derived state, side effects, and testable workflows into hooks rather than embedding them directly in component files.
- Design hooks with focused inputs/outputs so they are easier to unit test independently from the rendered component.

## Architecture rules

- Prefer class-based designs for services, factories, providers, storage, and other reusable application infrastructure.
- When a module represents a service with behavior/stateful dependencies, expose a class plus a shared instance instead of loose exported functions.
- Real call sites should use the class instance/factory directly; avoid keeping function wrappers around class methods unless there is a strong compatibility reason.
- Provider implementations must extend the abstract base provider, and provider/runtime selection must go through the class-based factory.
- Keep provider-specific connection tests and streaming behavior inside the provider class itself.
- Do not add legacy storage fallbacks or migrations unless explicitly requested; treat new storage schemas as canonical going forward.

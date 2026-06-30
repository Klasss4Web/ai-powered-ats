# Agent Instructions for ATS Matcher

## Styling Rules (Strict)

- **External CSS is the ONLY primary styling method.** All components, pages, and layouts MUST use external `.css` files for their styles.
- Inline `style={{ ... }}` objects and `style` attributes are **strictly forbidden** except for:
  - Dynamic values that cannot be known at build time (e.g., width derived from a prop like `width: `${percent}%``).
  - Third-party component overrides where no CSS class hook exists.
- Use CSS Modules (`*.module.css`) or co-located `.css` files imported directly into the component file.
- Name CSS classes using **kebab-case** (e.g., `.action-card`, `.modal-overlay`).
- Prefer utility-class frameworks (e.g., Tailwind) only if the project already uses them. Otherwise, stick to plain external CSS.
- Never use `styled-components`, `emotion`, or CSS-in-JS libraries.
- When refactoring existing code, migrate inline styles to external CSS files incrementally; do not add new inline styles.

## Other Guidelines

- Follow the existing file and folder structure.
- Keep components small and focused.
- Prefer functional components with hooks.
- Run existing tests after changes.

## Backend Architecture

- Shared business logic that is used by multiple route modules should live in `backend/services/` (e.g., `llm_service.py`, `file_service.py`).
- Route modules (`backend/routes/*.py`) should import shared utilities from `backend/services/` rather than from each other to avoid tight coupling.
- When adding new domain features, create a dedicated route module and register it via a `register_*_routes(app)` function in `backend/app.py`.

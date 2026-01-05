# Coding Style (AI-First)

## Goals
- Keep code easy to navigate for AI and humans: explicit types, predictable errors, and clear module boundaries.
- Prefer small, testable functions for loader/action logic.

## Type Hinting (TypeScript)
- All exported functions must declare parameter and return types.
- Avoid `any`. Use `unknown` and narrow with type guards when needed.
- Prefer `type` aliases for plain object shapes; use `interface` only when extension is required.
- Use `satisfies` to validate object shapes without widening types.
- Use explicit `null` where absence is meaningful; avoid `undefined` in persisted data.
- Avoid type assertions (`as`) unless you have already validated the shape.

## Documentation (JSDoc)
- Add JSDoc to all exported functions that are non-trivial or have side effects.
- Use this format:
  ```
  /**
   * Short summary sentence.
   *
   * @param paramName - What it is and valid range.
   * @returns What the function returns.
   * @throws {Response} When the request is invalid or a required binding is missing.
   */
  ```
- For complex SQL helpers, include the table name and expected columns in the doc.

## Error Handling
- In loaders/actions, validate inputs early and return `Response.json({ error })` with a proper status.
- Use `throw Response.json(...)` for early exits when you want the router to handle it.
- Centralize env checks in `require*` helpers (e.g., `requireBlogDb`, `requireBlogImagesBucket`).
- Log unexpected errors once (server-side) and return user-safe error messages.
- For API routes, always return a stable shape: `{ ok: true, ... }` or `{ error: string }`.

## Data Access (D1/R2)
- Always use prepared statements and `bind` parameters (no string interpolation).
- Convert DB values into domain types at the boundary (e.g., booleans, arrays, JSON).
- Ensure tables/columns via `ensure*` helpers before queries that rely on them.
- R2 uploads must set `contentType` and caching headers; file names should be deterministic.

## React Components
- Keep components pure; side effects belong in `useEffect` with stable dependencies.
- Extract heavy logic into `app/lib/**` and keep render functions small.
- Use `useMemo` only when it prevents expensive recomputation.

## File Naming
- Use kebab-case for new route files (`rng-prompt.tsx`, `concert-events.tsx`).
- Keep feature-specific logic co-located; avoid generic names like `data.tsx` or `admin.tsx`.

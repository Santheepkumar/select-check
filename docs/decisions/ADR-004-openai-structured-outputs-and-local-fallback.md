# ADR-004: OpenAI Structured Outputs (`json_schema`) with Deterministic Local Fallback

## Status
Accepted

## Date
2026-11-06

## Context
When the user clicks the Floating Ball, SelectCheck needs OpenAI to return:
- The detected language of the selected text (`detectedLanguage`).
- Exactly 3 distinct rewrite styles (`grammar_fix`, `clear_concise`, `professional_polished`), each with its rewritten `text` and a brief `summary`.
Additionally, developers and automated CI tests need to be able to run the full stack locally even before configuring a paid `OPENAI_API_KEY`.

## Decision
1. Use OpenAI `gpt-4o-mini` with **Structured Outputs** (`response_format: { type: 'json_schema', json_schema: { name: 'grammar_suggestions_response', strict: true, ... } }`) in `apps/api/src/services/openai.ts`.
2. Provide a deterministic heuristic fallback (`buildLocalHeuristicSuggestions`) whenever `OPENAI_API_KEY` is not present in the environment.

## Alternatives Considered

### Free-Form Prompting or Basic `json_object` Mode
- **Pros**: Slightly shorter request payload.
- **Cons**: Basic `json_object` mode does not enforce property names or nesting, risking runtime `TypeError`s in the desktop popover if the model omits a style or renames a key.
- **Rejected**: `strict: true` JSON Schema guarantees 100% schema conformance.

### Requiring `OPENAI_API_KEY` for All Local Runs and Tests
- **Pros**: Simpler `openai.ts` implementation.
- **Cons**: Breaks zero-config local evaluation (`pnpm dev:api` + `pnpm dev:desktop`) and makes unit tests dependent on external network calls or mocks.
- **Rejected**: Built-in heuristic fallback allows instant local testing and fast, deterministic CI runs.

## Consequences
- **Positive**: Sub-second response latency (`gpt-4o-mini`) with zero JSON parsing failures.
- **Positive**: `pnpm test` and `pnpm dev:api` work immediately after `git clone && pnpm install` with zero secrets required, and switch seamlessly to live OpenAI calls as soon as `OPENAI_API_KEY` is exported.

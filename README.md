# Backstage Scaffolder Markdown Merge

[![CI](https://github.com/joint-song/backstage-plugin-scaffolder-markdown-merge/actions/workflows/ci.yml/badge.svg)](https://github.com/joint-song/backstage-plugin-scaffolder-markdown-merge/actions/workflows/ci.yml)

A [Backstage](https://backstage.io) scaffolder action that merges multiple Markdown fragments into a target document at named slot markers. Useful for composing `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, and other Markdown files from reusable, independently-maintained fragments during Software Template execution.

The action id is `markdown:merge`.

## Slot Markers

The action looks for HTML-comment-style markers in the target file:

```markdown
<!-- MD_SLOT: NAME -->
... content to be replaced or appended to ...
<!-- /MD_SLOT: NAME -->
```

A single opening tag is also accepted; the closing tag is auto-generated on first merge:

```markdown
<!-- MD_SLOT: NAME -->
```

The marker name `MD_SLOT` was chosen to avoid collision with HTML `<slot>` elements and common templating engines.

## Installation

In your Backstage project, add this action to the backend:

```console
yarn workspace backend add @shawncheng888/plugin-scaffolder-backend-module-markdown-merge
```

Then register the action in `packages/backend/src/index.ts`:

```ts
// packages/backend/src/index.ts
import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();
// ... other backend.add(...) calls
backend.add(import('backstage-plugin-scaffolder-markdown-merge'));

backend.start();
```

## Usage

Add a step to your Software Template:

```yaml
# template.yaml
spec:
  type: markdown-merge
  steps:
    - id: merge-docs
      action: markdown:merge
      input:
        path: AGENTS.md
        slots:
          - name: coding-standards
            fragmentPath: fragments/coding-standards.md
          - name: deployment
            fragmentPath: fragments/deploy.md
```

### Input parameters

| Name                 | Type                                       | Required | Default   | Description                                                                                                                                                                                                                                            |
| -------------------- | ------------------------------------------ | -------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `path`               | `string`                                   | Yes      | —         | Path to the target Markdown file, relative to the scaffolder workspace (e.g. `AGENTS.md`).                                                                                                                                                            |
| `slots`              | `Array<{ name, fragmentPath }>`            | Yes      | —         | Fragments to merge in. `name` is the slot marker name (matches `MD_SLOT: <name>`); `fragmentPath` is the path to the fragment file, relative to the workspace.                                                                                          |
| `mode`               | `'replace' \| 'append'`                    | No       | `replace` | How to merge into a paired slot. `replace` overwrites the existing content between the markers; `append` keeps it and inserts the fragment after it. Has no effect for the single-tag fallback.                                                        |
| `onFragmentMissing`  | `'error' \| 'warn' \| 'ignore'`            | No       | `warn`    | Behavior when a fragment file does not exist. `error` throws and fails the step; `warn` logs a warning and skips the slot; `ignore` skips silently.                                                                                                     |
| `onSlotMissing`      | `'error' \| 'warn' \| 'ignore'`            | No       | `warn`    | Behavior when no slot marker is found in the target file. `error` throws and fails the step; `warn` logs a warning and continues with the next slot; `ignore` continues silently.                                                                    |

The target file itself is always required; a missing target file fails the step regardless of these options.

### Examples

#### Replace mode (default)

Target file before merge (`AGENTS.md`):

```markdown
# Project

## Coding standards
<!-- MD_SLOT: coding-standards -->
PLACEHOLDER
<!-- /MD_SLOT: coding-standards -->

## Deployment
<!-- MD_SLOT: deployment -->
```

Fragment file (`fragments/coding-standards.md`):

```markdown
- Use TypeScript
- Run `yarn lint` before committing
- Follow Conventional Commits for PR titles
```

After execution, `AGENTS.md` becomes:

```markdown
# Project

## Coding standards
<!-- MD_SLOT: coding-standards -->
- Use TypeScript
- Run `yarn lint` before committing
- Follow Conventional Commits for PR titles
<!-- /MD_SLOT: coding-standards -->

## Deployment
<!-- MD_SLOT: deployment -->
```

#### Append mode

With `mode: append`, the existing content between paired markers is preserved and the fragment is appended after it:

```yaml
- id: merge-docs
  action: markdown:merge
  input:
    path: AGENTS.md
    mode: append
    slots:
      - name: deployment
        fragmentPath: fragments/deploy.md
```

If the target previously contained:

```markdown
<!-- MD_SLOT: deployment -->
Existing step 1
Existing step 2
<!-- /MD_SLOT: deployment -->
```

After append, it becomes:

```markdown
<!-- MD_SLOT: deployment -->
Existing step 1
Existing step 2
New fragment content
<!-- /MD_SLOT: deployment -->
```

#### Single-tag fallback

If the target contains only an opening tag:

```markdown
<!-- MD_SLOT: optional-section -->
```

After merge, the action auto-completes it:

```markdown
<!-- MD_SLOT: optional-section -->
<fragment content>
<!-- /MD_SLOT: optional-section -->
```

This is convenient for templates that minimize placeholder boilerplate.

#### Strict mode

To fail loudly on configuration mistakes:

```yaml
- id: merge-docs
  action: markdown:merge
  input:
    path: AGENTS.md
    onFragmentMissing: error
    onSlotMissing: error
    slots:
      - name: coding-standards
        fragmentPath: fragments/coding-standards.md
```

Any missing fragment or unmatched slot marker will fail the step, surfacing typos and broken paths during template execution rather than silently producing a half-merged document.

## Development

### Build

```console
yarn install
yarn build
```

### Test

```console
yarn test
```

Tests use Jest with `@swc/jest` for fast TypeScript transformation. The pure functions in `src/actions/merge.ts` (`mergeSlot`, `handleMissing`) are unit-tested directly without mocks.

### Project layout

```
src/
├── index.ts                        # Re-exports
└── actions/
    ├── merge.ts                    # Pure: mergeSlot, handleMissing
    ├── merge.test.ts               # Unit tests
    └── markdownMerge.ts            # Backstage action factory + filesystem IO
```

The core merge logic is intentionally split from the Backstage action factory so it can be unit-tested without spinning up a scaffolder context.

## Releasing

Publishing is automated via GitHub Actions and **npm Trusted Publishing (OIDC)** — no long-lived npm token is stored as a repository secret.

### One-time setup

The package must exist on npm before Trusted Publishing can be configured against it. For the very first release:

1. Log in locally: `npm login`
2. Build and publish once with provenance enabled, which both creates the package and primes the provenance chain:
   ```console
   yarn install
   yarn build
   yarn npm publish --provenance --access public
   ```
3. On [npmjs.com](https://www.npmjs.com/package/@shawncheng888/plugin-scaffolder-backend-module-markdown-merge) → Settings → **Trusted publishers** → Add a trusted publisher:
   - Provider: **GitHub Actions**
   - Repository owner: **joint-song**
   - Repository name: **backstage-plugin-scaffolder-markdown-merge**
   - Workflow filename: **release.yml**
   - Environment name: **npm** (must match the `environment` block in the workflow, or leave blank if you remove it)

### Cutting a release

1. Bump the version locally: `yarn version --new-version <patch|minor|major>` (or edit `package.json` by hand).
2. Commit and push: `git push && git push --tags`.
3. On GitHub, go to **Releases** → **Draft a new release** → pick the tag (`v0.1.1` etc.) → **Publish**.

The `Release` workflow runs, attaches a signed provenance attestation, and the new version appears on npm within ~30 seconds.

## License

Apache-2.0 — see [LICENSE](LICENSE).

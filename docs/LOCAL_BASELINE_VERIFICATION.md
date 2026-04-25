# Local Baseline Verification

## Purpose

This report records the current local verification baseline for the TVIK Estimator application during the move from Lovable prototype work into a controlled GitHub/Codex workflow.

This is a documentation-only report. It does not change app behavior, pricing, estimator calculations, proposal/PDF logic, approval logic, database schema, package files, or client-facing behavior.

## 1. Local Environment Summary

- Branch: `codex-transition`
- Preferred package manager for this baseline: `npm`
- Reason: `package-lock.json` exists and local `npm install` completed successfully.
- Current lock-file note: `package-lock.json`, `bun.lock`, and `bun.lockb` may all exist in the repository. Do not delete or standardize lock files as part of this baseline report.
- Local dependency install result: successful.
- Local production build result: successful.
- Local app run result: app runs at `localhost`.
- Git status note: clean after restoring `package-lock.json`.

## 2. Commands Successfully Run

The local setup result provided for this baseline confirms these commands/actions succeeded:

- `npm install`
- `npm run build`
- Local app run at `localhost`
- Git working tree confirmed clean after restoring `package-lock.json`

No additional code changes are included in this documentation task.

## 3. Build Result

`npm run build` passed.

This means the application currently produces a successful build in the local environment after dependencies are installed with npm.

## 4. Local Run Result

The app runs locally at `localhost`.

This confirms the app can start in the local development environment and is available for manual smoke testing.

## 5. Known Lint Baseline Problem

`npm run lint` currently fails with the existing lint baseline.

The known lint problem should be treated as migration cleanup work, not as a new runtime failure from this documentation task. The reported lint categories include:

- Many `@typescript-eslint/no-explicit-any` warnings/errors.
- Some `no-empty` issues.
- Some `no-empty-object-type` issues.
- React hook dependency warnings.
- React refresh warnings.

Recommended handling:

- Keep lint cleanup staged and reviewable.
- Do not run broad automatic fixes blindly.
- Do not clean all files in one patch.
- Avoid touching estimator totals, pricing, proposal/PDF output, approval behavior, database schema, or client-facing commitments during early lint cleanup.

## 6. Important App Routes Tested Manually

The local app run at `localhost` should preserve the following important route areas during manual baseline checks and future migration testing:

- `/login`
- `/`
- `/admin-dashboard`
- `/estimates`
- `/estimates/new`
- `/estimates/:id`
- `/cost-library`
- `/risk-library`
- `/cost-audit`
- `/review-queue`
- `/contracts`
- `/contracts/:id`
- `/jobs`
- `/jobs/calendar`
- `/jobs/:id`
- `/field`
- `/field/:id`
- `/admin`

For each route, the safe manual check is basic: the page loads, obvious navigation still works, and no pricing/proposal/approval behavior is changed without a dedicated reviewed patch.

## 7. Current Migration Status

Current status:

- Documentation foundation has been started for the Lovable-to-Codex migration.
- Local `npm install` is confirmed working.
- Local `npm run build` is confirmed passing.
- Local app run at `localhost` is confirmed working.
- Lint is still failing because of the existing baseline.
- No app behavior changes have been made as part of this baseline report.

Migration interpretation for a non-engineer owner:

- The app can currently be installed, built, and opened locally.
- The codebase still needs cleanup before lint can become a hard quality gate.
- The next work should be small, controlled patches that are easy to review and do not change business-critical estimator behavior.

## 8. Next Recommended Safe Patch

Recommended next patch:

`chore: clean low-risk UI lint warnings`

Scope for the first safe patch:

- Touch only low-risk display/UI files.
- Prefer files that do not calculate totals, change proposal/PDF output, update approval state, write to Supabase, or affect client-facing commitments.
- Replace obvious unsafe `any` usage only where the correct type is clear.
- Leave medium-risk and high-risk business logic files for later patches after each area has a focused review plan.

Do not include these areas in the first lint cleanup patch:

- Pricing logic.
- Estimator calculations.
- Proposal/PDF generation.
- Approval workflow.
- Supabase migrations or database schema.
- Sent proposal records, revisions, or client-facing commitments.

## Protected Areas Confirmed Unchanged

This documentation task does not change:

- Runtime app files.
- Package files.
- Pricing logic.
- Estimator calculations.
- Proposal/PDF logic.
- Approval logic.
- Database schema.
- Supabase migrations.
- Client-facing behavior.

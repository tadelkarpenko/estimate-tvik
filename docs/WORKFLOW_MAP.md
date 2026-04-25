# Workflow Map

## 1. Login And App Shell

Files: `src/App.tsx`, `src/contexts/AuthContext.tsx`, `src/components/AppLayout.tsx`, `src/components/AppSidebar.tsx`.

Flow: user opens app, Supabase checks session, unauthenticated users go to `/login`, authenticated users load protected pages inside `AppLayout`.

## 2. Estimate Creation

Files: `src/pages/NewEstimate.tsx`, `src/lib/store.ts`, `src/lib/types.ts`.

Flow: user opens `/estimates/new`, enters client/project/scope fields, saves draft or generates, and the estimate is saved to Supabase table `estimates`.

Control rule: estimate records are business-critical and should not be silently overwritten.

## 3. Deterministic Estimate Generation

Files: `src/pages/NewEstimate.tsx`, `src/lib/costEngine.ts`, `src/lib/riskEngine.ts`, `src/lib/store.ts`.

Flow: app validates fields, loads cost/risk libraries, runs `runCostEngine`, runs `runRiskEngine`, applies overhead/profit/contingency, saves estimate and canonical line items.

Control rule: deterministic numbers come first. AI must not finalize pricing.

## 4. AI Scope And Audit

Files: `src/lib/generators.ts`, `src/pages/NewEstimate.tsx`.

Flow: after deterministic totals, the app calls Supabase Edge Function `estimate-ai` to draft scope narrative and internal price audit.

Control rule: AI text is advisory and must not replace deterministic totals.

## 5. AI Intake

Files: `src/components/AIIntakePanel.tsx`, `src/components/MediaUploader.tsx`, `src/lib/suggestionStore.ts`, `src/lib/areaStore.ts`.

Flow: user adds notes, voice, area notes, or photos; AI analyzes them; suggestions enter the review queue.

Control rule: AI can suggest; humans approve. AI may not invent measurements.

## 6. Review Queue

Files: `src/pages/ReviewQueuePage.tsx`, `src/lib/suggestionStore.ts`.

Flow: human reviews AI-created suggestions and can approve, edit, reject, or reset them.

Control rule: review queue is a control point, not a bypass around approvals.

## 7. Public/Internal Proposal Output

Files: `src/lib/pdfGenerator.ts`, `src/pages/NewEstimate.tsx`, `src/pages/EstimatesList.tsx`.

Flow: user generates public or internal PDFs. Public PDF should include client-facing estimate information. Internal PDF may include internal margin, audit, and risk details.

Control rule: internal financial controls must stay separate from client-facing outputs.

## 8. Estimate Acceptance And Contract Creation

Files: `src/pages/NewEstimate.tsx`, `src/lib/contractStore.ts`, `src/lib/contractTypes.ts`.

Flow: human marks an estimate as `Accepted`, app creates a contract record, links line items, and creates revision/audit evidence.

Control rule: acceptance is a business-critical status change and must remain human-controlled.

## 9. Job Creation

Files: `src/pages/NewEstimate.tsx`, `src/lib/jobStore.ts`, job pages under `src/pages`.

Flow: user creates a job from an estimate, and the job is saved in Supabase table `jobs`.

## 10. Dashboard And Operational Review

Files: `src/pages/Dashboard.tsx`, `src/lib/store.ts`, `src/lib/contractStore.ts`.

Flow: dashboard loads estimates, audits, cost library, and contracts; it shows pipeline and action queue information.

Control rule: dashboard should surface risk; it should not silently resolve business-critical issues.

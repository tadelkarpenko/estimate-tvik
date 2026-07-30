import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listEstimates from "./tools/list-estimates";
import getEstimate from "./tools/get-estimate";
import listJobs from "./tools/list-jobs";
import listContracts from "./tools/list-contracts";
import searchCostLibrary from "./tools/search-cost-library";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "estimate-genius",
  title: "Estimate Genius",
  version: "0.1.0",
  instructions:
    "Read-only tools for the TVIK Estimator system. Use list_estimates / get_estimate for estimate scope, line items and totals; list_jobs for scheduling; list_contracts for contract financials; search_cost_library for reference pricing. All data is scoped to the signed-in user. These tools never modify estimates, contracts or jobs.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listEstimates, getEstimate, listJobs, listContracts, searchCostLibrary],
});

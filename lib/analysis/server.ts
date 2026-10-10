import "server-only";
import { getBackend, getViewer, BackendError } from "@/lib/backend";
import pkg from "@/package.json";
import { analyze } from "./analyze";
import { parseAnalysisQuery } from "./options";

export const APP_VERSION = pkg.version;

/** Muat dan analisis untuk API riset: staf saja; kepemilikan kelas ditegakkan backend/DB. */
export async function loadAnalysis(url: URL, scope: "riset_read" | "riset_export" = "riset_read") {
  const viewer = await getViewer();
  if (viewer.kind !== "staff") throw new BackendError("forbidden", "Masuk sebagai guru atau peneliti.");
  const { classId, ruleSetId, options } = parseAnalysisQuery(Object.fromEntries(url.searchParams));
  const backend = getBackend();
  await backend.rateLimit(scope);
  const ds = await backend.analysisDataset(classId, ruleSetId);
  return { backend, classId, options, ds, analysis: analyze(ds, options) };
}

import { SAVE_KEY } from "./campaign.mjs?v=dev";

// One storage write commits campaign totals/settlement ledger and the active checkpoint
// together. A failed write leaves the previous envelope available for safe retry/recovery.
export function saveCampaignEnvelope(storage, progress, activeMission) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify({ ...progress, activeMission }));
    return true;
  } catch { return false; }
}

const SYNC_INTERVAL_MS = 5 * 60 * 1000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { syncBlocksForAllUsers } = await import("@/lib/block-sync");
  setInterval(() => {
    syncBlocksForAllUsers().catch(() => {});
  }, SYNC_INTERVAL_MS);
}

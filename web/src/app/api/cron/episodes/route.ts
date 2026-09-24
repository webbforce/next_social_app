import { generateDueEpisodes } from "@/lib/episode-render";
import { runStageAMaintenance } from "@/lib/stage-a-jobs";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret) return auth === `Bearer ${secret}`;
  return process.env.NODE_ENV !== "production";
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [episodes, maintenance] = await Promise.all([generateDueEpisodes(), runStageAMaintenance()]);
  return Response.json({ ...episodes, ...maintenance });
}
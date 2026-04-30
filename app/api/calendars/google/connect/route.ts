import { auth } from "@/lib/auth";
import { getAuthUrl } from "@/lib/google-calendar";
import { redirect } from "next/navigation";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const url = getAuthUrl(session.user.id);
  return redirect(url);
}

import { auth } from "@/lib/auth";
import { getAuthUrl } from "@/lib/microsoft-calendar";
import { redirect } from "next/navigation";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  return redirect(getAuthUrl(session.user.id));
}

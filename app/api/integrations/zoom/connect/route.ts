import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/integrations/zoom/callback`;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.ZOOM_CLIENT_ID!,
    redirect_uri: redirectUri,
  });
  const zoomUrl = `https://zoom.us//oauth/authorize?${params.toString()}`;

  return NextResponse.redirect(zoomUrl);
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateToken } from "@/lib/livekit";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomName } = await request.json();

  if (!roomName) {
    return NextResponse.json(
      { error: "roomName is required" },
      { status: 400 }
    );
  }

  // Verify user is a member of a group in this room
  const { data: groupMember } = await supabase
    .from("group_members")
    .select("group_id, groups(livekit_room_name)")
    .eq("user_id", user.id)
    .single();

  if (!groupMember) {
    return NextResponse.json(
      { error: "Not a member of any group" },
      { status: 403 }
    );
  }

  // Get profile for identity
  const { data: profile } = await supabase
    .from("profiles")
    .select("instagram_handle")
    .eq("id", user.id)
    .single();

  const identity = profile?.instagram_handle ?? user.id;

  const token = await generateToken(user.id, roomName, identity);

  return NextResponse.json({ token });
}

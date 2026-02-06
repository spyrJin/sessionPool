/**
 * LiveKit server-side helpers.
 * Room creation and token generation.
 */

import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

function getLiveKitConfig() {
  const url = process.env.LIVEKIT_URL!;
  const apiKey = process.env.LIVEKIT_API_KEY!;
  const apiSecret = process.env.LIVEKIT_API_SECRET!;
  return { url, apiKey, apiSecret };
}

/**
 * Create a LiveKit room for a matched group.
 */
export async function createRoom(
  roomName: string,
  durationMinutes: number,
  maxParticipants: number
) {
  const { url, apiKey, apiSecret } = getLiveKitConfig();
  const roomService = new RoomServiceClient(url, apiKey, apiSecret);

  await roomService.createRoom({
    name: roomName,
    emptyTimeout: 300, // 5 min empty → auto-close
    maxParticipants,
    metadata: JSON.stringify({ durationMinutes }),
  });
}

/**
 * Generate an access token for a user to join a LiveKit room.
 */
export async function generateToken(
  userId: string,
  roomName: string,
  identity: string
): Promise<string> {
  const { apiKey, apiSecret } = getLiveKitConfig();

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    metadata: JSON.stringify({ userId }),
  });

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });

  return await token.toJwt();
}

/**
 * Delete a LiveKit room (cleanup).
 */
export async function deleteRoom(roomName: string) {
  const { url, apiKey, apiSecret } = getLiveKitConfig();
  const roomService = new RoomServiceClient(url, apiKey, apiSecret);

  await roomService.deleteRoom(roomName);
}

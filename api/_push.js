// api/_push.js — Expo push notification helper.
//
// iOS client registers via expo-notifications and persists the resulting
// token in users.expo_push_token. This helper sends a push to one of those
// tokens; the iOS app's tap handler in lib/pushNotifications.ts reads
// notification.data.type and routes accordingly:
//   { type: "day3-pulse" }  → /(tabs)/studio/pulse
//   { type: "day7-studio" } → /(tabs)/studio
//
// On invalid/expired tokens (DeviceNotRegistered) we clear the column so
// the next registration round can refresh it without continually retrying
// a dead token.

import { Expo } from "expo-server-sdk";
import { supabase } from "./_supabase.js";

const expo = new Expo({
  // Optional — for higher rate limits + visibility in the Expo dashboard.
  // Not required for basic delivery.
  accessToken: process.env.EXPO_ACCESS_TOKEN,
});

/**
 * Send a push to a single token.
 * @param {string} token        Expo push token (ExponentPushToken[...])
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.body
 * @param {object} [opts.data]  Arbitrary payload; iOS handler reads `data.type`.
 * @param {string} [opts.userId] If supplied, on DeviceNotRegistered we clear users.expo_push_token for this user.
 * @returns {Promise<{ok: boolean, skipped?: boolean, reason?: string, ticket?: object, error?: string}>}
 */
export async function sendPush(token, { title, body, data, userId } = {}) {
  if (!token) return { ok: false, skipped: true, reason: "no token" };
  if (!Expo.isExpoPushToken(token)) {
    return { ok: false, skipped: true, reason: "invalid token format" };
  }

  const message = {
    to: token,
    sound: "default",
    title,
    body,
    data: data || {},
  };

  try {
    const tickets = [];
    for (const chunk of expo.chunkPushNotifications([message])) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }
    const ticket = tickets[0];

    // If Expo rejected the token outright (DeviceNotRegistered), clear it
    // so we stop trying. Other ticket errors are transient — leave the
    // token alone.
    if (ticket?.status === "error" && ticket?.details?.error === "DeviceNotRegistered" && userId) {
      await supabase.from("users").update({ expo_push_token: null }).eq("id", userId);
      return { ok: false, ticket, reason: "DeviceNotRegistered, cleared token" };
    }

    return { ok: ticket?.status === "ok", ticket };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

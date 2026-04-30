// src/lib/auth.js
// Thin wrapper around the Capacitor GoogleAuth plugin.
// AppContext handles the rest (api.signInWithGoogle, sync, premium refresh).

import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Capacitor } from '@capacitor/core';

const WEB_CLIENT_ID =
  '799746399408-5om8a45pd34el37692evtlkhsla7o613.apps.googleusercontent.com';

let initialized = false;

// Call once at app startup. On native, the plugin reads config from
// capacitor.config.ts; on web, we must pass clientId explicitly.
export async function initGoogleAuth() {
  if (initialized) return;
  try {
    // This plugin requires explicit initialize() on ALL platforms, not just web.
    // On native, it still reads serverClientId from capacitor.config, but the
    // initialize() call is what actually creates the GoogleSignInClient.
    await GoogleAuth.initialize({
      clientId: WEB_CLIENT_ID,
      scopes: ['profile', 'email'],
      grantOfflineAccess: true,
    });
    initialized = true;
  } catch (err) {
    console.error('[auth] GoogleAuth.initialize failed:', err);
  }
}

// Returns the credential object AppContext.signIn expects to forward to
// api.signInWithGoogle. Throws on user cancel or plugin error — caller
// decides how to handle UI.
export async function getGoogleCredential() {
  const user = await GoogleAuth.signIn();

  const idToken = user?.authentication?.idToken;
  if (!idToken) {
    throw new Error('Google sign-in returned no ID token');
  }

  // Shape chosen to match common backend contract: { idToken } plus a profile
  // hint the backend can ignore. If api.signInWithGoogle expects a raw token
  // string, change this to `return idToken;` and update AppContext accordingly.
  return {
    idToken,
    profile: {
      id: user.id,
      email: user.email,
      name: user.name,
      imageUrl: user.imageUrl,
    },
  };
}

export async function signOutGoogle() {
  try {
    await GoogleAuth.signOut();
  } catch (err) {
    console.error('[auth] GoogleAuth.signOut failed:', err);
  }
}

// Useful at startup to silently restore a session if the user is still
// signed in with Google (doesn't re-prompt). Returns null if no session.
export async function restoreGoogleSession() {
  try {
    const user = await GoogleAuth.refresh();
    return user || null;
  } catch {
    return null;
  }
}

// Error-code helper — GoogleAuth surfaces string codes on Android.
// '12501' = user cancelled the sign-in sheet (not an error to show).
export function isUserCancelled(err) {
  const msg = String(err?.message || err || '');
  return msg.includes('12501') || msg.toLowerCase().includes('cancel');
}

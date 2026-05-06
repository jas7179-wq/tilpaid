// src/lib/apple.js
//
// Thin wrapper around the @capacitor-community/apple-sign-in plugin.
// Mirrors the shape of src/lib/auth.js (Google) so AppContext can call
// either with the same pattern.
//
// Behavior:
//   - On native iOS: uses Apple's native ASAuthorizationController flow
//     (system-modal sheet, FaceID/TouchID, etc.)
//   - On Android: opens the web auth flow (browser/webview to appleid.apple.com)
//   - On web: same as Android — uses the web auth flow
//
// Returns a credential object the backend's /api/auth/apple endpoint expects:
//   { identityToken, fullName }
// where fullName is { givenName, familyName } or null. Apple sends the name
// ONLY on the very first sign-in for a given Apple ID + Service ID pair —
// subsequent sign-ins return null for the name fields. The backend stores the
// name on first sign-in and never relies on it being present afterwards.

import { SignInWithApple } from '@capacitor-community/apple-sign-in';
import { Capacitor } from '@capacitor/core';

// Service ID from Apple Developer console. Must match what's configured in
// the Service ID's "Sign in with Apple" capability (Domains and Return URLs).
// On native iOS, Apple ignores this and uses the App ID (com.midlinedigital.tilpaid)
// — so the value here only matters for the web flow on Android.
const SERVICE_ID = 'com.midlinedigital.tilpaid.signin';

// Redirect URL must match exactly what's configured in Apple Developer console
// for the Service ID. Apple validates this server-side and refuses to issue a
// token if it doesn't match.
const REDIRECT_URI = 'https://tilpaid-api-production.up.railway.app/api/auth/apple/callback';

// Returns the credential AppContext.signIn expects to forward to
// api.signInWithApple. Throws on user cancel or plugin error — caller decides
// how to handle UI.
export async function getAppleCredential() {
  const options = {
    clientId: SERVICE_ID,
    redirectURI: REDIRECT_URI,
    scopes: 'email name',
    // state and nonce: random values that Apple echoes back. Useful for CSRF
    // protection on the web flow. The plugin generates these for us when
    // omitted, which is fine for our purposes.
  };

  const result = await SignInWithApple.authorize(options);

  // Plugin returns { response: { identityToken, authorizationCode, user, email,
  //                              givenName, familyName, ... } }
  const r = result?.response;
  const idToken = r?.identityToken;

  if (!idToken) {
    throw new Error('Apple sign-in returned no identity token');
  }

  // Build fullName only if at least one part is present. Apple sends these
  // ONLY on first sign-in; on subsequent sign-ins the fields are absent.
  let fullName = null;
  if (r.givenName || r.familyName) {
    fullName = {
      givenName: r.givenName || null,
      familyName: r.familyName || null,
    };
  }

  return {
    identityToken: idToken,
    fullName,
    profile: {
      // Apple's `user` field is the stable Apple ID (sub claim), only sent
      // on first auth like the name. Backend extracts sub from the verified
      // token, so we don't strictly need this here, but include for parity
      // with the Google credential shape.
      id: r.user || null,
      email: r.email || null,
      name: fullName
        ? [fullName.givenName, fullName.familyName].filter(Boolean).join(' ')
        : null,
    },
  };
}

// Apple Sign-In doesn't have an explicit "sign out" — the system handles
// session state internally. There's nothing to call here. Kept for symmetry
// with the Google flow so AppContext can call both unconditionally without
// special-casing.
export async function signOutApple() {
  // No-op
}

// Detect "user cancelled" errors so callers can suppress the "sign-in failed"
// alert. Apple plugin throws different error codes/messages depending on
// platform — this checks the most common ones.
export function isUserCancelled(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  // iOS native: error code 1001 = ASAuthorizationErrorCanceled
  // Web flow: messages contain "cancel" / "user_cancelled_authorize" / etc.
  return (
    msg.includes('1001') ||
    msg.includes('cancel') ||
    msg.includes('user_cancelled') ||
    msg.includes('popup_closed')
  );
}

export function isNative() {
  return Capacitor.isNativePlatform();
}

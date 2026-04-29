import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';

// RevenueCat API keys — replace with production keys when ready
const RC_GOOGLE_KEY = 'goog_gNRAghTCpPKpKpvGCRzatjEesnY'; // from RevenueCat dashboard → API Keys → Google
const RC_APPLE_KEY = 'appl_YOUR_APPLE_API_KEY';   // from RevenueCat dashboard → API Keys → Apple

// Entitlement ID — must match what you create in RevenueCat dashboard
const ENTITLEMENT_ID = 'Midline Digital LLC / TilPaid Pro';

let isConfigured = false;

/**
 * Initialize RevenueCat SDK
 * Call once on app startup (in AppContext init)
 */
export async function initRevenueCat() {
  if (!Capacitor.isNativePlatform()) {
    console.log('RevenueCat: skipping init on web');
    return;
  }

  if (isConfigured) return;

  try {
    const platform = Capacitor.getPlatform();
    const apiKey = platform === 'ios' ? RC_APPLE_KEY : RC_GOOGLE_KEY;

    await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG }); // change to WARN for production
    await Purchases.configure({ apiKey });

    isConfigured = true;
    console.log('RevenueCat: configured for', platform);
  } catch (err) {
    console.error('RevenueCat: init failed', err);
  }
}

/**
 * Identify the current user to RevenueCat. Call after sign-in completes.
 *
 * Stitches the RevenueCat anonymous ID to our database User.id so the
 * webhook payloads carry the right app_user_id. Without this, RevenueCat
 * tracks purchases against an anonymous ID that the server can't map back.
 *
 * Safe to call multiple times — RevenueCat handles idempotency and
 * cross-device alias merging server-side.
 */
export async function setRevenueCatUser(userId) {
  if (!Capacitor.isNativePlatform() || !isConfigured) return;
  if (!userId) {
    console.warn('RevenueCat: setRevenueCatUser called with no userId');
    return;
  }

  try {
    await Purchases.logIn({ appUserID: userId });
    console.log('RevenueCat: identified as user', userId);
  } catch (err) {
    console.error('RevenueCat: logIn failed', err);
  }
}

/**
 * Reset RevenueCat to anonymous mode. Call on sign-out.
 *
 * Without this, the next user signing in on the same device would briefly
 * inherit the previous user's entitlement state until the next logIn fires.
 */
export async function clearRevenueCatUser() {
  if (!Capacitor.isNativePlatform() || !isConfigured) return;

  try {
    await Purchases.logOut();
    console.log('RevenueCat: logged out, anonymous mode');
  } catch (err) {
    // Throws if already anonymous — not actually an error.
    if (!err.message?.includes('anonymous')) {
      console.error('RevenueCat: logOut failed', err);
    }
  }
}

/**
 * Check if the user has an active premium entitlement
 * Returns true/false
 */
export async function checkPremiumStatus() {
  if (!Capacitor.isNativePlatform() || !isConfigured) {
    return false;
  }

  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
    return !!entitlement;
  } catch (err) {
    console.error('RevenueCat: failed to check entitlements', err);
    return false;
  }
}

/**
 * Get available packages (subscription offerings)
 * Returns the current offering's available packages
 */
export async function getOfferings() {
  if (!Capacitor.isNativePlatform() || !isConfigured) {
    return null;
  }

  try {
    const result = await Purchases.getOfferings();
    const offerings = result?.offerings || result;
    const current = offerings?.current;
    if (current && current.availablePackages && current.availablePackages.length > 0) {
     return current;
    }
    return null;
  } catch (err) {
    console.error('RevenueCat: failed to get offerings', err);
    return null;
  }
}

/**
 * Purchase a package
 * Returns { success: boolean, isPremium: boolean, error?: string }
 */
export async function purchasePackage(pkg) {
  if (!Capacitor.isNativePlatform() || !isConfigured) {
    return { success: false, error: 'Not available on web' };
  }

  try {
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    const isPremium = !!customerInfo.entitlements.active[ENTITLEMENT_ID];
    return { success: true, isPremium };
  } catch (err) {
    // User cancelled is not an error
    if (err.code === 1 || err.message?.includes('cancelled') || err.message?.includes('canceled')) {
      return { success: false, error: 'cancelled' };
    }
    console.error('RevenueCat: purchase failed', err);
    return { success: false, error: err.message || 'Purchase failed' };
  }
}

/**
 * Restore purchases (required by App Store / Play Store policies)
 * Returns { success: boolean, isPremium: boolean, error?: string }
 */
export async function restorePurchases() {
  if (!Capacitor.isNativePlatform() || !isConfigured) {
    return { success: false, error: 'Not available on web' };
  }

  try {
    const { customerInfo } = await Purchases.restorePurchases();
    const isPremium = !!customerInfo.entitlements.active[ENTITLEMENT_ID];
    return { success: true, isPremium };
  } catch (err) {
    console.error('RevenueCat: restore failed', err);
    return { success: false, error: err.message || 'Restore failed' };
  }
}

/**
 * Check if running on a native platform (not web)
 */
export function isNative() {
  return Capacitor.isNativePlatform();
}

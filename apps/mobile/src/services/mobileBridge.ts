/**
 * Mobile platform bridge providing native device integrations:
 * - Direct Android native bridge integration via window.AndroidNative
 * - Real system permission detection & OS settings launchers
 * - Clipboard management
 * - WhatsApp direct sharing & OS share sheet
 * - Haptic feedback for mobile taps
 * - Floating assistant bubble toggle
 */

export interface PermissionStatus {
  overlayGranted: boolean;
  accessibilityGranted: boolean;
  batteryOptimizationsIgnored: boolean;
  isBubbleRunning?: boolean;
}

interface AndroidNativeInterface {
  openAccessibilitySettings: () => void;
  openOverlaySettings: () => void;
  openAppDetailsSettings: () => void;
  isAccessibilityServiceEnabled: () => boolean;
  canDrawOverlays: () => boolean;
  toggleFloatingBubble: (enable: boolean) => void;
  isFloatingBubbleRunning: () => boolean;
  replaceTextInActiveApp: (newText: string) => boolean;
}

declare global {
  interface Window {
    AndroidNative?: AndroidNativeInterface;
    __SELECTCHECK_REFRESH_PERMS__?: () => void;
    __SELECTCHECK_INCOMING_TEXT__?: string;
  }
}

const PERMISSIONS_STORAGE_KEY = 'selectcheck_mobile_permissions';

export function isAndroidNativeAvailable(): boolean {
  return typeof window !== 'undefined' && Boolean(window.AndroidNative);
}

export function getStoredPermissions(): PermissionStatus {
  // Check real Android OS permissions if running inside Android WebView
  if (isAndroidNativeAvailable() && window.AndroidNative) {
    try {
      const a11y = window.AndroidNative.isAccessibilityServiceEnabled();
      const overlay = window.AndroidNative.canDrawOverlays();
      const bubble = window.AndroidNative.isFloatingBubbleRunning();
      return {
        overlayGranted: overlay,
        accessibilityGranted: a11y,
        batteryOptimizationsIgnored: true,
        isBubbleRunning: bubble
      };
    } catch (e) {
      console.warn('Error reading real Android permissions:', e);
    }
  }

  try {
    const raw = localStorage.getItem(PERMISSIONS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error('Failed reading permissions from storage', err);
  }

  return {
    overlayGranted: false,
    accessibilityGranted: false,
    batteryOptimizationsIgnored: false,
    isBubbleRunning: false
  };
}

export function savePermissions(perms: PermissionStatus): void {
  try {
    localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(perms));
  } catch (err) {
    console.error('Failed saving permissions', err);
  }
}

export function openNativeAccessibilitySettings(): void {
  if (isAndroidNativeAvailable() && window.AndroidNative) {
    triggerHaptic('medium');
    window.AndroidNative.openAccessibilitySettings();
  } else {
    console.log('Simulating open accessibility settings in browser/iOS');
  }
}

export function openNativeOverlaySettings(): void {
  if (isAndroidNativeAvailable() && window.AndroidNative) {
    triggerHaptic('medium');
    window.AndroidNative.openOverlaySettings();
  } else {
    console.log('Simulating open overlay settings in browser/iOS');
  }
}

export function openNativeAppDetailsSettings(): void {
  if (isAndroidNativeAvailable() && window.AndroidNative) {
    triggerHaptic('medium');
    window.AndroidNative.openAppDetailsSettings();
  } else {
    console.log('Simulating open app details settings in browser/iOS');
  }
}

export function toggleNativeFloatingBubble(enable: boolean): void {
  if (isAndroidNativeAvailable() && window.AndroidNative) {
    triggerHaptic('medium');
    window.AndroidNative.toggleFloatingBubble(enable);
  }
}

export function replaceActiveAppText(newText: string): boolean {
  if (isAndroidNativeAvailable() && window.AndroidNative) {
    return window.AndroidNative.replaceTextInActiveApp(newText);
  }
  return false;
}

/**
 * Trigger subtle haptic feedback on mobile touch.
 */
export function triggerHaptic(type: 'light' | 'medium' | 'success' = 'light'): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (type === 'light') navigator.vibrate(12);
      else if (type === 'medium') navigator.vibrate(25);
      else if (type === 'success') navigator.vibrate([15, 40, 15]);
    } catch {
      // Ignore vibration errors on unsupported environments
    }
  }
}

/**
 * Read text from system clipboard.
 */
export async function readClipboardText(): Promise<string> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      const text = await navigator.clipboard.readText();
      return text || '';
    }
  } catch (err) {
    console.warn('Clipboard read failed or permission denied:', err);
  }
  return '';
}

/**
 * Write text to system clipboard.
 */
export async function writeClipboardText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      triggerHaptic('success');
      return true;
    }
  } catch (err) {
    console.warn('Clipboard write failed:', err);
  }
  return false;
}

/**
 * Directly shares or opens WhatsApp with the revised text pre-filled.
 */
export async function shareToWhatsApp(text: string): Promise<boolean> {
  triggerHaptic('medium');
  const encodedText = encodeURIComponent(text);

  // 1. Try native Web Share API first if available on mobile
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        text
      });
      return true;
    } catch {
      // If cancelled or failed, fall through to schema
    }
  }

  // 2. Direct WhatsApp URL schema
  try {
    window.location.href = `whatsapp://send?text=${encodedText}`;
    return true;
  } catch {
    const webUrl = `https://wa.me/?text=${encodedText}`;
    window.open(webUrl, '_blank');
    return false;
  }
}

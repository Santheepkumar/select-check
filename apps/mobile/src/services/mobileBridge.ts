/**
 * Mobile platform bridge providing native device integrations:
 * - Clipboard management
 * - WhatsApp direct sharing & OS share sheet
 * - Haptic feedback for mobile taps
 * - Android overlay and accessibility service simulation & bridge
 */

export interface PermissionStatus {
  overlayGranted: boolean;
  accessibilityGranted: boolean;
  batteryOptimizationsIgnored: boolean;
}

const PERMISSIONS_STORAGE_KEY = 'selectcheck_mobile_permissions';

export function getStoredPermissions(): PermissionStatus {
  try {
    const raw = localStorage.getItem(PERMISSIONS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error('Failed reading permissions from storage', err);
  }
  return {
    overlayGranted: false,
    accessibilityGranted: false,
    batteryOptimizationsIgnored: false
  };
}

export function savePermissions(perms: PermissionStatus): void {
  try {
    localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(perms));
  } catch (err) {
    console.error('Failed saving permissions', err);
  }
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
    } catch (shareErr) {
      // If user cancelled, return; otherwise fall back to WhatsApp URL schema
      if (shareErr instanceof Error && shareErr.name === 'AbortError') {
        return false;
      }
    }
  }

  // 2. Fall back to direct WhatsApp URL scheme (works on iOS and Android)
  const whatsappUrl = `whatsapp://send?text=${encodedText}`;
  const webWhatsAppUrl = `https://api.whatsapp.com/send?text=${encodedText}`;

  try {
    window.location.href = whatsappUrl;
    setTimeout(() => {
      // If WhatsApp is not installed, open web WhatsApp
      window.open(webWhatsAppUrl, '_blank');
    }, 600);
    return true;
  } catch (err) {
    console.error('Failed to open WhatsApp:', err);
    window.open(webWhatsAppUrl, '_blank');
    return false;
  }
}

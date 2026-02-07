/**
 * Initialize Google Sign-In
 */
export function initializeGoogleSignIn(
  clientId: string,
  callback: (response: { credential: string }) => void
): void {
  // Wait for Google Sign-In script to load
  if (typeof window !== 'undefined' && (window as any).google) {
    (window as any).google.accounts.id.initialize({
      client_id: clientId,
      callback: callback,
    });
  } else {
    // Retry after a short delay if script hasn't loaded yet
    setTimeout(() => {
      if ((window as any).google) {
        (window as any).google.accounts.id.initialize({
          client_id: clientId,
          callback: callback,
        });
      }
    }, 500);
  }
}

/**
 * Trigger Google Sign-In prompt
 */
export function promptGoogleSignIn(): void {
  if (typeof window !== 'undefined' && (window as any).google) {
    (window as any).google.accounts.id.prompt();
  }
}

/**
 * Trigger one-tap Google Sign-In
 */
export function renderGoogleButton(
  elementId: string,
  callback: (response: { credential: string }) => void
): void {
  if (typeof window !== 'undefined' && (window as any).google) {
    (window as any).google.accounts.id.renderButton(
      document.getElementById(elementId),
      {
        theme: 'outline',
        size: 'large',
        width: '100%',
        text: 'signin_with',
      }
    );
    
    (window as any).google.accounts.id.prompt((notification: any) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // One-tap not available, user can click button
      }
    });
  }
}

/**
 * Initialize Apple Sign-In
 * Apple Sign-In requires server-side redirect flow or Apple JS SDK
 * For now, we'll redirect to backend endpoint
 */
export function redirectToAppleSignIn(): void {
  window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/auth/apple`;
}

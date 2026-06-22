import { useEffect } from 'react';

// Extend window interface for TypeScript compliance
declare global {
  interface Window {
    formIsDirty?: boolean;
  }
}

/**
 * Custom hook to guard against unsaved form changes.
 * Binds to window beforeunload to intercept browser reloads/closes,
 * and sets a global flag so that layouts/navbars can intercept route transitions.
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  useEffect(() => {
    if (isDirty) {
      window.formIsDirty = true;
    } else {
      window.formIsDirty = false;
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.formIsDirty = false;
    };
  }, [isDirty]);
}

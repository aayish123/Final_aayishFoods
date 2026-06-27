import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';
import { toast } from 'sonner';

// Inactivity intervals in milliseconds
const WARNING_TIMEOUT = 25 * 60 * 1000; // 25 minutes
const LOGOUT_TIMEOUT = 30 * 60 * 1000;  // 30 minutes
const CHECK_INTERVAL = 1000; // Check every second

interface SessionTimeoutContextType {
  resetTimer: () => void;
}

const SessionTimeoutContext = createContext<SessionTimeoutContextType | null>(null);

export function SessionTimeoutProvider({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes (300 seconds) remaining count
  
  const lastActivityRef = useRef<number>(Date.now());
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning((prev) => {
      if (prev) {
        toast.info('Session timer extended.');
      }
      return false;
    });
  }, []);

  useEffect(() => {
    if (!user) {
      // Clear timers if user is not authenticated
      if (logoutTimerRef.current) clearInterval(logoutTimerRef.current);
      setShowWarning(false);
      return;
    }

    // Reset last activity when component mounts/user logs in
    lastActivityRef.current = Date.now();

    // Event listeners for activity
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll'];
    const handleActivity = () => resetTimer();

    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // Check timer loop
    logoutTimerRef.current = setInterval(() => {
      const inactiveTime = Date.now() - lastActivityRef.current;

      if (inactiveTime >= LOGOUT_TIMEOUT) {
        // Force logout
        handleForceLogout();
      } else if (inactiveTime >= WARNING_TIMEOUT) {
        // Show warning
        setShowWarning(true);
        // Calculate remaining seconds
        const secondsRemaining = Math.max(0, Math.ceil((LOGOUT_TIMEOUT - inactiveTime) / 1000));
        setTimeLeft(secondsRemaining);
      } else {
        setShowWarning(false);
      }
    }, CHECK_INTERVAL);

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (logoutTimerRef.current) clearInterval(logoutTimerRef.current);
    };
  }, [user, resetTimer]);

  const handleForceLogout = async () => {
    if (logoutTimerRef.current) clearInterval(logoutTimerRef.current);
    setShowWarning(false);
    try {
      await signOut();
      toast.error('Session expired due to inactivity. Please log in again.');
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Session timeout logout failed:', err);
    }
  };

  const handleManualLogout = async () => {
    setShowWarning(false);
    try {
      await signOut();
      toast.success('Logged out successfully.');
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <SessionTimeoutContext.Provider value={{ resetTimer }}>
      {children}

      <Dialog open={showWarning} onOpenChange={(open) => {
        if (!open) {
          resetTimer();
        }
      }}>
        <DialogContent className="w-[92vw] max-h-[90vh] overflow-y-auto sm:max-w-[440px] rounded-2xl border border-gray-100 bg-white shadow-2xl p-6">
          <DialogHeader className="flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 mb-4 animate-bounce">
              <Clock className="h-6 w-6" />
            </div>
            <DialogTitle className="font-serif text-xl font-bold text-[#5c2018]">
              Inactivity Warning
            </DialogTitle>
            <DialogDescription className="text-gray-500 text-sm mt-2 leading-relaxed">
              You have been inactive for over 25 minutes. For security, your session will automatically terminate in:
            </DialogDescription>
          </DialogHeader>

          <div className="my-6 text-center">
            <span className="text-3xl font-mono font-bold text-amber-600 bg-amber-50 px-4 py-2 rounded-xl border border-amber-100/50 shadow-inner">
              {formatTime(timeLeft)}
            </span>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:space-x-3 w-full">
            <Button
              variant="outline"
              onClick={handleManualLogout}
              className="w-full sm:flex-1 h-11 rounded-xl border-gray-200 hover:bg-red-50 hover:text-red-600 text-gray-700 font-semibold"
            >
              Logout Now
            </Button>
            <Button
              onClick={resetTimer}
              className="w-full sm:flex-1 h-11 rounded-xl bg-[#1a3b2b] hover:bg-[#122b20] text-[#d4af37] font-semibold shadow-md"
            >
              Stay Logged In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SessionTimeoutContext.Provider>
  );
}

export function useSessionTimeout() {
  const context = useContext(SessionTimeoutContext);
  if (!context) {
    throw new Error('useSessionTimeout must be used within a SessionTimeoutProvider');
  }
  return context;
}

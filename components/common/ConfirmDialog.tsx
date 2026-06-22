import React, { createContext, useContext, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, AlertCircle, HelpCircle } from 'lucide-react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
  onCancel?: () => void;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => void;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  const confirm = (opts: ConfirmOptions) => {
    setOptions(opts);
    setIsOpen(true);
  };

  const handleConfirm = () => {
    if (options?.onConfirm) options.onConfirm();
    setIsOpen(false);
  };

  const handleCancel = () => {
    if (options?.onCancel) options.onCancel();
    setIsOpen(false);
  };

  const getIcon = () => {
    switch (options?.variant) {
      case 'danger':
        return <AlertCircle className="h-6 w-6" />;
      case 'warning':
        return <AlertTriangle className="h-6 w-6" />;
      default:
        return <HelpCircle className="h-6 w-6" />;
    }
  };

  const getIconContainerStyles = () => {
    switch (options?.variant) {
      case 'danger':
        return 'bg-red-50 text-red-600';
      case 'warning':
        return 'bg-amber-50 text-amber-600';
      default:
        return 'bg-emerald-50 text-[#1a3b2b]';
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-2xl border border-gray-100 bg-white shadow-2xl p-6">
          <DialogHeader className="flex flex-col items-center text-center">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center mb-4 ${getIconContainerStyles()}`}>
              {getIcon()}
            </div>
            <DialogTitle className="font-serif text-xl font-bold text-[#5c2018]">
              {options?.title || 'Are you sure?'}
            </DialogTitle>
            <DialogDescription className="text-gray-500 text-sm mt-2 leading-relaxed">
              {options?.message}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:space-x-3 w-full mt-6">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="w-full sm:flex-1 h-11 rounded-xl border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold"
            >
              {options?.cancelText || 'Cancel'}
            </Button>
            <Button
              onClick={handleConfirm}
              className={`w-full sm:flex-1 h-11 rounded-xl font-semibold shadow-md text-white ${
                options?.variant === 'danger'
                  ? 'bg-red-600 hover:bg-red-700'
                  : options?.variant === 'warning'
                    ? 'bg-amber-500 hover:bg-amber-600'
                    : 'bg-[#1a3b2b] hover:bg-[#122b20] text-[#d4af37]'
              }`}
            >
              {options?.confirmText || 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}

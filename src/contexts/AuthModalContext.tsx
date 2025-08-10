import { createContext, useContext, useState } from 'react';

interface AuthModalContextType {
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  isPasswordResetModalOpen: boolean;
  openPasswordResetModal: () => void;
  closePasswordResetModal: () => void;
}

const AuthModalContext = createContext<AuthModalContextType | undefined>(undefined);

export const useAuthModal = () => {
  const context = useContext(AuthModalContext);
  if (!context) {
    throw new Error('useAuthModal must be used within an AuthModalProvider');
  }
  return context;
};

export const AuthModalProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isPasswordResetModalOpen, setIsPasswordResetModalOpen] = useState(false);

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);
  const openPasswordResetModal = () => setIsPasswordResetModalOpen(true);
  const closePasswordResetModal = () => setIsPasswordResetModalOpen(false);

  const value = {
    isAuthModalOpen,
    openAuthModal,
    closeAuthModal,
    isPasswordResetModalOpen,
    openPasswordResetModal,
    closePasswordResetModal
  };

  return (
    <AuthModalContext.Provider value={value}>
      {children}
    </AuthModalContext.Provider>
  );
}; 
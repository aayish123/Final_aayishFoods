import { Loader2 } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full py-12 animate-fade-in">
      <div className="relative flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#1a3b2b]" />
        <span className="absolute text-[10px] font-bold font-serif text-[#d4af37] uppercase tracking-wider">A</span>
      </div>
      <p className="mt-4 font-serif text-[#1a3b2b] text-xs font-semibold uppercase tracking-widest animate-pulse">
        Loading traditional taste...
      </p>
    </div>
  );
}

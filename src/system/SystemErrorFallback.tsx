import { Button } from '@/components/ui/button';
import { RefreshCw, Home, AlertOctagon } from 'lucide-react';

interface SystemErrorFallbackProps {
  error: Error | null;
  resetError: () => void;
}

export default function SystemErrorFallback({ error, resetError }: SystemErrorFallbackProps) {
  const handleGoHome = () => {
    window.location.href = '/admin';
  };

  return (
    <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-white border-t-4 border-[#5c2018] rounded-2xl shadow-xl p-8 text-center space-y-6">
        <div className="h-16 w-16 bg-[#5c2018]/10 text-[#5c2018] rounded-full flex items-center justify-center mx-auto shadow-sm">
          <AlertOctagon className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <h2 className="font-serif text-[#5c2018] text-2xl font-bold">System Error Encountered</h2>
          <p className="text-gray-500 text-sm">
            An unexpected runtime error crashed the active application component. We apologize for the inconvenience.
          </p>
        </div>

        {error && (
          <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 text-left text-xs text-red-800 font-mono max-h-40 overflow-y-auto whitespace-pre-wrap">
            {error.name}: {error.message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button
            onClick={() => {
              resetError();
              window.location.reload();
            }}
            className="bg-[#1a3b2b] hover:bg-[#122b20] text-[#d4af37] font-semibold rounded-xl h-10 px-5 flex items-center justify-center gap-1.5 shadow-md"
          >
            <RefreshCw className="h-4 w-4" /> Refresh Portal
          </Button>
          <Button
            onClick={handleGoHome}
            variant="outline"
            className="border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl h-10 px-5 flex items-center justify-center gap-1.5"
          >
            <Home className="h-4 w-4" /> Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

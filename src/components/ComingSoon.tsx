import { Clock, Coffee } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface ComingSoonProps {
  category: string;
  description?: string;
}

const ComingSoon = ({ category, description }: ComingSoonProps) => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <Card className="max-w-md w-full text-center shadow-xl">
        <CardContent className="p-8">
          <div className="mb-6">
            <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Coffee className="h-12 w-12 text-orange-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {category}
            </h1>
            <div className="flex items-center justify-center space-x-2 text-orange-600 mb-4">
              <Clock className="h-5 w-5" />
              <span className="font-semibold">Launching Soon</span>
            </div>
          </div>
          
          <p className="text-gray-600 mb-6">
            {description || `We're working hard to bring you the best ${category.toLowerCase()}. Stay tuned for delicious surprises!`}
          </p>
          
          <div className="bg-orange-50 rounded-lg p-4">
            <p className="text-sm text-orange-800">
              🎉 Get ready for amazing {category.toLowerCase()} that will make your taste buds dance!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComingSoon; 
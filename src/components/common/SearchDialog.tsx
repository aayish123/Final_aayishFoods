import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getOptimizedImageUrl } from '@/lib/utils';

interface SearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  in_stock: boolean | null;
  food_item_variants: {
    price: number;
    label: string;
  }[];
}

export default function SearchDialog({ isOpen, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categories, setCategories] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      fetchCategories();
    }
  }, [isOpen]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.trim() || selectedCategory !== 'All') {
        performSearch();
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query, selectedCategory]);

  const fetchCategories = async () => {
    try {
      const { data } = await supabase
        .from('categories')
        .select('name')
        .order('display_order', { ascending: true });
      if (data) {
        setCategories(['All', ...data.map((c) => c.name)]);
      }
    } catch (err) {
      console.error('Error fetching categories for search:', err);
    }
  };

  const performSearch = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('food_items')
        .select('*, food_item_variants(price, label)')
        .eq('status', 'published');

      if (query.trim()) {
        q = q.or(`name.ilike.%${query}%,description.ilike.%${query}%,short_description.ilike.%${query}%`);
      }

      if (selectedCategory !== 'All') {
        q = q.eq('category', selectedCategory);
      }

      const { data, error } = await q.limit(10);
      if (error) throw error;

      setResults((data as unknown as SearchResult[]) || []);
      
      // Log search activity to customer_activity table if query is not empty
      if (query.trim()) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('customer_activity').insert({
            customer_id: user.id,
            activity_type: 'search_performed',
            description: `Searched for: "${query}"`,
            metadata: { query, category: selectedCategory }
          } as any);
        }
      }
    } catch (err) {
      console.error('Search query failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (id: string) => {
    onClose();
    navigate(`/food/${id}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[92vw] max-h-[90vh] sm:max-w-2xl bg-white border border-[#e5d4c0] p-0 overflow-hidden shadow-2xl rounded-2xl flex flex-col">
        <DialogHeader className="p-6 bg-secondary/10 border-b border-border/40 flex flex-row items-center justify-between">
          <DialogTitle className="font-serif text-2xl text-foreground flex items-center gap-2">
            <Search className="h-6 w-6 text-primary" />
            Search Aayish Catalog
          </DialogTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8 hover:bg-muted/50">
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        {/* Categories Selector */}
        <div className="px-6 py-4 flex gap-2 overflow-x-auto scrollbar-none border-b border-border/20 bg-muted/10">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase transition-all whitespace-nowrap border ${
                selectedCategory === cat
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-white text-muted-foreground border-border/50 hover:border-primary/50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-6 border-b border-border/20">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What are you craving today? e.g. Avakaya, Sweets..."
              className="h-14 pl-12 pr-6 rounded-xl bg-muted/20 border-border/50 focus-visible:ring-primary focus-visible:border-primary text-base font-serif"
              autoFocus
            />
          </div>
        </div>

        {/* Search Results */}
        <div className="max-h-[350px] overflow-y-auto divide-y divide-border/20">
          {loading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
              <span>Searching catalog...</span>
            </div>
          ) : results.length > 0 ? (
            results.map((item) => {
              const price = item.food_item_variants?.[0]?.price;
              const weight = item.food_item_variants?.[0]?.label;
              return (
                <div
                  key={item.id}
                  onClick={() => handleResultClick(item.id)}
                  className="flex items-center gap-4 p-4 hover:bg-secondary/5 cursor-pointer transition-colors"
                >
                  <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden shrink-0 border border-border/40">
                    <img
                      src={getOptimizedImageUrl(item.image_url)}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-serif font-bold text-foreground truncate">{item.name}</h4>
                      {price !== undefined && (
                        <span className="font-bold text-primary shrink-0">₹{price}</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center mt-1 text-xs text-muted-foreground">
                      <span>Category: {item.category || 'Traditional'}</span>
                      {weight && <span>Pack Size: {weight}</span>}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              );
            })
          ) : query.trim() ? (
            <div className="p-12 text-center text-muted-foreground">
              No products found matching "{query}"
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground font-serif">
              Type above to search for delicious pickles, sweets, and snacks
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

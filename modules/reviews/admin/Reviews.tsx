import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Star,
  MessageSquare,
  RefreshCw,
  Check,
  X,
  EyeOff,
  Reply,
  Calendar,
  User,
  ShoppingBag,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'hidden';
  is_featured: boolean;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
  user_id: string;
  food_items: {
    name: string;
  } | null;
  profiles: {
    full_name: string | null;
  } | null;
}

export default function AdminReviews() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'hidden' | 'featured'>('all');

  // Drawer / Dialog states
  const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [savingReply, setSavingReply] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          food_items (
            name
          ),
          profiles:user_id (
            full_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews((data as unknown as ReviewItem[]) || []);
    } catch (err) {
      const error = err as Error;
      toast.error(`Error fetching reviews: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (reviewId: string, status: 'approved' | 'rejected' | 'hidden') => {
    try {
      const { error } = await supabase
        .from('reviews')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', reviewId);

      if (error) throw error;
      toast.success(`Review marked as ${status}`);
      fetchReviews();
      if (selectedReview?.id === reviewId) {
        setSelectedReview(prev => prev ? { ...prev, status } : null);
      }
    } catch (err) {
      const error = err as Error;
      toast.error(`Update failed: ${error.message}`);
    }
  };

  const handleToggleFeatured = async (reviewId: string, currentFeatured: boolean) => {
    try {
      const { error } = await supabase
        .from('reviews')
        .update({
          is_featured: !currentFeatured,
          updated_at: new Date().toISOString()
        })
        .eq('id', reviewId);

      if (error) throw error;
      toast.success(`Review ${!currentFeatured ? 'added to' : 'removed from'} featured list`);
      fetchReviews();
      if (selectedReview?.id === reviewId) {
        setSelectedReview(prev => prev ? { ...prev, is_featured: !currentFeatured } : null);
      }
    } catch (err) {
      const error = err as Error;
      toast.error(`Toggle featured failed: ${error.message}`);
    }
  };

  const handleOpenDrawer = (review: ReviewItem) => {
    setSelectedReview(review);
    setReplyText(review.admin_reply || '');
    setIsDrawerOpen(true);
  };

  const handleSaveReply = async () => {
    if (!selectedReview) return;
    setSavingReply(true);

    try {
      const { error } = await supabase
        .from('reviews')
        .update({
          admin_reply: replyText || null,
          replied_by: user?.id || null,
          replied_at: replyText ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedReview.id);

      if (error) throw error;
      toast.success('Admin reply recorded successfully');
      setIsDrawerOpen(false);
      fetchReviews();
    } catch (err) {
      const error = err as Error;
      toast.error(`Failed to record reply: ${error.message}`);
    } finally {
      setSavingReply(false);
    }
  };

  const filteredReviews = reviews.filter(r => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'featured') return r.is_featured;
    return r.status === activeFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'rejected':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'hidden':
        return 'bg-gray-100 text-gray-700 border-gray-300';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#5c2018]">Reviews & Moderation</h1>
          <p className="text-gray-500 text-sm mt-1">moderate customer feedback, toggle featured placements, and publish admin replies</p>
        </div>
        <Button onClick={fetchReviews} variant="outline" className="border-gray-200 bg-white hover:bg-gray-50">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Sync Reviews
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 pb-1 border-b border-gray-200">
        {[
          { label: 'All Reviews', value: 'all' },
          { label: 'Pending Moderation', value: 'pending' },
          { label: 'Approved', value: 'approved' },
          { label: 'Rejected', value: 'rejected' },
          { label: 'Hidden', value: 'hidden' },
          { label: 'Featured Placement ⭐', value: 'featured' }
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveFilter(tab.value as typeof activeFilter)}
            className={`px-4 py-3 border-b-2 text-xs font-bold uppercase tracking-wider transition-all -mb-[2px] ${
              activeFilter === tab.value
                ? 'border-[#1a3b2b] text-[#1a3b2b]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Container */}
      <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl overflow-hidden shadow-sm">
        <CardContent className="p-0">
          {loading && reviews.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <RefreshCw className="h-8 w-8 text-[#1a3b2b] animate-spin mx-auto mb-2" />
              <span>Loading reviews dossier...</span>
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <MessageSquare className="h-12 w-12 mx-auto stroke-1 text-gray-300 mb-2" />
              <p className="font-semibold text-sm">No reviews found matching this filter.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredReviews.map((review) => (
                <div key={review.id} className="p-6 hover:bg-gray-50/50 transition-colors flex flex-col md:flex-row justify-between items-start gap-4">
                  {/* Left Side: Rating, Comment, details */}
                  <div className="space-y-2.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center text-amber-500">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 shrink-0 ${
                              i < review.rating ? 'fill-amber-500 text-amber-500' : 'text-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                      <Badge variant="outline" className={`capitalize text-[9px] font-bold ${getStatusBadge(review.status)}`}>
                        {review.status}
                      </Badge>
                      {review.is_featured && (
                        <Badge className="bg-amber-100 text-amber-800 border-none font-bold text-[8px] uppercase">
                          Featured
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-gray-700 font-medium leading-relaxed italic">
                      "{review.comment || <span className="text-gray-300">No written review content</span>}"
                    </p>

                    {review.admin_reply && (
                      <div className="bg-[#fdfbf7] p-3 rounded-xl border border-gray-100 text-xs mt-2 pl-4 border-l-2 border-l-[#1a3b2b]">
                        <span className="font-bold text-[#1a3b2b] uppercase text-[9px] block mb-1">Admin Response:</span>
                        <p className="text-gray-600 font-medium">"{review.admin_reply}"</p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-400 font-bold uppercase pt-1">
                      <span className="flex items-center"><User className="h-3.5 w-3.5 mr-1" /> {review.profiles?.full_name || 'Anonymous User'}</span>
                      <span className="flex items-center"><ShoppingBag className="h-3.5 w-3.5 mr-1" /> {review.food_items?.name || 'Unknown Delicacy'}</span>
                      <span className="flex items-center"><Clock className="h-3.5 w-3.5 mr-1" /> {new Date(review.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Right Side: Quick Action buttons */}
                  <div className="flex flex-wrap md:flex-nowrap gap-1.5 md:self-center shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleFeatured(review.id, review.is_featured)}
                      className={`h-9 px-3 rounded-lg text-xs font-bold border ${
                        review.is_featured
                          ? 'border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                      title={review.is_featured ? "Remove from Featured" : "Pin as Featured"}
                    >
                      <Star className={`h-4 w-4 mr-1 ${review.is_featured ? 'fill-amber-500 text-amber-500' : ''}`} />
                      Feature
                    </Button>

                    {review.status !== 'approved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(review.id, 'approved')}
                        className="h-9 px-3 rounded-lg text-xs font-bold border-green-100 text-green-700 hover:bg-green-50"
                      >
                        <Check className="h-4 w-4 mr-1 text-green-600" />
                        Approve
                      </Button>
                    )}

                    {review.status !== 'rejected' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(review.id, 'rejected')}
                        className="h-9 px-3 rounded-lg text-xs font-bold border-red-100 text-red-700 hover:bg-red-50"
                      >
                        <X className="h-4 w-4 mr-1 text-red-600" />
                        Reject
                      </Button>
                    )}

                    {review.status !== 'hidden' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(review.id, 'hidden')}
                        className="h-9 px-3 rounded-lg text-xs font-bold border-gray-200 text-gray-500 hover:bg-gray-100"
                        title="Hide from public"
                      >
                        <EyeOff className="h-4 w-4 mr-1" />
                        Hide
                      </Button>
                    )}

                    <Button
                      size="sm"
                      onClick={() => handleOpenDrawer(review)}
                      className="h-9 px-3 rounded-lg text-xs font-bold bg-[#1a3b2b] text-[#d4af37] hover:bg-[#122b20]"
                    >
                      <Reply className="h-4 w-4 mr-1" />
                      Reply
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reply Dialog */}
      <Dialog open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DialogContent className="bg-white rounded-2xl border border-gray-100 max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-[#5c2018] text-xl font-bold">Write Response Reply</DialogTitle>
            <DialogDescription className="text-gray-400">
              Your response will be displayed publicly below this customer's review on the menu product detail page.
            </DialogDescription>
          </DialogHeader>

          {selectedReview && (
            <div className="space-y-4 py-2">
              {/* Original Review summary box */}
              <div className="bg-[#fdfbf7] p-4 rounded-xl border border-gray-100 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-900">{selectedReview.profiles?.full_name || 'Anonymous User'}</span>
                  <div className="flex items-center text-amber-500">
                    {Array.from({ length: selectedReview.rating }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-current" />
                    ))}
                  </div>
                </div>
                <p className="text-gray-600 font-medium leading-relaxed italic">
                  "{selectedReview.comment || 'No written text'}"
                </p>
                <span className="text-[10px] text-gray-400 block pt-1">
                  Product: {selectedReview.food_items?.name} • Submitted: {new Date(selectedReview.created_at).toLocaleDateString()}
                </span>
              </div>

              {/* Reply inputs */}
              <div className="space-y-1.5">
                <Label htmlFor="reply" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Admin Reply Text</Label>
                <Textarea
                  id="reply"
                  placeholder="Thank the user, address constructive feedback, or describe any corrective action..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="rounded-xl border-gray-200 text-xs h-32"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDrawerOpen(false)} className="rounded-xl">Cancel</Button>
            <Button
              onClick={handleSaveReply}
              disabled={savingReply}
              className="bg-[#1a3b2b] text-[#d4af37] hover:bg-[#122b20] rounded-xl font-bold"
            >
              {savingReply ? 'Publishing Reply...' : 'Publish Public Response'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

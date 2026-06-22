import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  ArrowLeft,
  User,
  MapPin,
  Clipboard,
  ShoppingBag,
  Star,
  Activity,
  Heart,
  Calendar,
  Phone,
  RefreshCw,
  Eye,
  MessageSquare,
  Edit,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { useCustomerDetails } from '@/shared/hooks/useCustomerDetails';
import { useCustomerNotes } from '@/shared/hooks/useCustomerNotes';
import { useUpdateCustomerNote } from '@/shared/hooks/useUpdateCustomerNote';
import { useDeleteCustomerNote } from '@/shared/hooks/useDeleteCustomerNote';

interface CustomerNote {
  id: string;
  note: string;
  created_at: string;
  admin_id: string | null;
  profiles?: {
    full_name: string | null;
  } | null;
}

export default function AdminCustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // React Query Hooks
  const { data: detail, isLoading, refetch } = useCustomerDetails(id) as any;
  const createNoteMutation = useCustomerNotes();
  const updateNoteMutation = useUpdateCustomerNote(id);
  const deleteNoteMutation = useDeleteCustomerNote(id);

  // Note edit/add states
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [isEditNoteOpen, setIsEditNoteOpen] = useState(false);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !id) return;

    try {
      await createNoteMutation.mutateAsync({
        customerId: id,
        adminId: user?.id || '',
        note: newNote
      });
      toast.success('Internal staff note recorded successfully');
      setNewNote('');
    } catch (err) {
      const error = err as Error;
      toast.error(`Note addition failed: ${error.message}`);
    }
  };

  const handleOpenEditNote = (note: CustomerNote) => {
    setEditingNoteId(note.id);
    setEditingNoteText(note.note);
    setIsEditNoteOpen(true);
  };

  const handleSaveEditNote = async () => {
    if (!editingNoteText.trim() || !editingNoteId) return;

    try {
      await updateNoteMutation.mutateAsync({
        noteId: editingNoteId,
        note: editingNoteText
      });
      toast.success('Internal staff note updated successfully');
      setIsEditNoteOpen(false);
      setEditingNoteId(null);
      setEditingNoteText('');
    } catch (err) {
      const error = err as Error;
      toast.error(`Note edit failed: ${error.message}`);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this internal note?')) return;

    try {
      await deleteNoteMutation.mutateAsync(noteId);
      toast.success('Internal staff note deleted successfully');
    } catch (err) {
      const error = err as Error;
      toast.error(`Note delete failed: ${error.message}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-2">
        <RefreshCw className="h-8 w-8 text-[#1a3b2b] animate-spin" />
        <span className="text-sm text-gray-500 font-medium">Loading customer dossier...</span>
      </div>
    );
  }

  if (!detail || !detail.profile) return null;

  const { profile, addresses, notes, activity: activities, orders, reviews, wishlistCount } = detail;

  // Metric summaries
  const completedOrders = orders.filter((o: any) => o.status === 'delivered');
  const totalOrdersCount = completedOrders.length;
  const ltv = completedOrders.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);
  const aov = totalOrdersCount > 0 ? ltv / totalOrdersCount : 0;
  const lastOrderDate = orders.length > 0 ? orders[0].created_at : null;

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/customers')} className="h-11 w-11 sm:h-9 sm:w-9 hover:bg-gray-100 shrink-0 flex items-center justify-center">
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </Button>
          <div>
            <h1 className="font-serif text-3xl font-bold text-[#5c2018]">{profile.full_name || 'Anonymous User'}</h1>
            <p className="text-gray-500 text-sm mt-1">Customer dossier • Member since {new Date(profile.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl shadow-sm text-center">
          <CardContent className="p-4">
            <ShoppingBag className="h-5 w-5 text-[#1a3b2b] mx-auto mb-1.5" />
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Completed Orders</p>
            <h4 className="text-lg font-bold text-gray-900 mt-1">{totalOrdersCount}</h4>
          </CardContent>
        </Card>

        <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl shadow-sm text-center">
          <CardContent className="p-4">
            <Star className="h-5 w-5 text-amber-500 mx-auto mb-1.5" />
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">LTV (INR)</p>
            <h4 className="text-lg font-bold text-gray-900 mt-1 font-mono">₹{ltv.toFixed(2)}</h4>
          </CardContent>
        </Card>

        <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl shadow-sm text-center">
          <CardContent className="p-4">
            <Star className="h-5 w-5 text-blue-500 mx-auto mb-1.5" />
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">AOV (INR)</p>
            <h4 className="text-lg font-bold text-gray-900 mt-1 font-mono">₹{aov.toFixed(2)}</h4>
          </CardContent>
        </Card>

        <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl shadow-sm text-center">
          <CardContent className="p-4">
            <Calendar className="h-5 w-5 text-purple-500 mx-auto mb-1.5" />
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Last Order</p>
            <h4 className="text-xs font-bold text-gray-900 mt-2.5">
              {lastOrderDate ? new Date(lastOrderDate).toLocaleDateString() : 'N/A'}
            </h4>
          </CardContent>
        </Card>

        <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl shadow-sm text-center">
          <CardContent className="p-4">
            <Heart className="h-5 w-5 text-red-500 mx-auto mb-1.5" />
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Wishlist Items</p>
            <h4 className="text-lg font-bold text-gray-900 mt-1">{wishlistCount} items</h4>
          </CardContent>
        </Card>

        <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl shadow-sm text-center">
          <CardContent className="p-4">
            <MessageSquare className="h-5 w-5 text-green-500 mx-auto mb-1.5" />
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Reviews count</p>
            <h4 className="text-lg font-bold text-gray-900 mt-1">{reviews.length} written</h4>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Customer Profile & Addresses & Internal Notes */}
        <div className="space-y-6">
          {/* Profile Overview */}
          <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl shadow-sm">
            <CardHeader className="border-b border-[#1a3b2b]/5 px-6 py-4">
              <CardTitle className="font-serif text-[#5c2018] text-lg font-bold flex items-center gap-2">
                <User className="h-5 w-5 text-[#1a3b2b]" />
                Customer Account Info
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4 text-xs font-semibold text-gray-600">
              <div className="flex justify-between">
                <span className="text-gray-400 uppercase text-[9px]">ID</span>
                <span className="font-mono text-gray-900">{profile.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 uppercase text-[9px]">Phone</span>
                <span className="text-gray-900 flex items-center"><Phone className="h-3 w-3 mr-1" /> {profile.phone || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 uppercase text-[9px]">Auth Provider</span>
                <span className="text-gray-900 capitalize">{profile.provider || 'email'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 uppercase text-[9px]">Account Role</span>
                <Badge variant="outline" className="bg-[#fdfbf7] text-[#1a3b2b] border-[#1a3b2b]/20 font-bold uppercase text-[8px]">
                  {profile.role}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Address Book */}
          <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl shadow-sm">
            <CardHeader className="border-b border-[#1a3b2b]/5 px-6 py-4">
              <CardTitle className="font-serif text-[#5c2018] text-lg font-bold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-[#1a3b2b]" />
                Address Book
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {addresses.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-4">No addresses linked to this account.</p>
              ) : (
                addresses.map((addr: any) => (
                  <div key={addr.id} className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold text-gray-700 relative">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-900 font-extrabold">{addr.full_name}</span>
                      {addr.is_default && (
                        <Badge className="bg-[#1a3b2b] text-[#d4af37] text-[8px] font-bold uppercase border-none px-1.5 py-0.5">
                          Default
                        </Badge>
                      )}
                    </div>
                    <p className="text-gray-400 mt-1">{addr.phone}</p>
                    <p className="text-gray-500 font-medium leading-relaxed mt-2">
                      {addr.address_line1}
                      {addr.address_line2 && `, ${addr.address_line2}`}
                      <br />
                      {addr.city}, {addr.state} - {addr.pincode}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Dedicated Customer Notes CRUD */}
          <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl shadow-sm">
            <CardHeader className="border-b border-[#1a3b2b]/5 px-6 py-4">
              <CardTitle className="font-serif text-[#5c2018] text-lg font-bold flex items-center gap-2">
                <Clipboard className="h-5 w-5 text-[#1a3b2b]" />
                Admin Customer Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <form onSubmit={handleAddNote} className="space-y-3">
                <Label htmlFor="customer-note" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Add Profile Note</Label>
                <Textarea
                  id="customer-note"
                  placeholder="Record customer preferences, delivery alerts, sensitive profile info..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="rounded-xl border-gray-200 text-xs"
                />
                <Button type="submit" className="bg-[#1a3b2b] hover:bg-[#122b20] text-[#d4af37] text-xs h-9 font-bold">
                  Add Note
                </Button>
              </form>

              <div className="divide-y divide-gray-100 border-t border-gray-100 pt-4 max-h-[300px] overflow-y-auto pr-1">
                {notes.length === 0 ? (
                  <p className="text-center py-4 text-xs text-gray-400">No profile notes recorded.</p>
                ) : (
                  notes.map((note: any) => (
                    <div key={note.id} className="py-3 flex justify-between items-start gap-4">
                      <div className="text-xs space-y-1">
                        <div className="flex items-center gap-2 text-gray-400 font-bold uppercase text-[9px]">
                          <span>{note.profiles?.full_name || 'System Staff'}</span>
                          <span>•</span>
                          <span>{new Date(note.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-gray-700 leading-relaxed font-medium">"{note.note}"</p>
                      </div>

                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenEditNote(note)}
                          className="h-11 w-11 sm:h-7 sm:w-7 text-blue-600 hover:bg-blue-50 flex items-center justify-center shrink-0"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteNote(note.id)}
                          className="h-11 w-11 sm:h-7 sm:w-7 text-red-600 hover:bg-red-50 flex items-center justify-center shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Columns: Orders ledger, reviews moderation, activity log */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order history */}
          <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl shadow-sm">
            <CardHeader className="border-b border-[#1a3b2b]/5 px-6 py-4">
              <CardTitle className="font-serif text-[#5c2018] text-lg font-bold flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-[#1a3b2b]" />
                Order Logs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left min-w-[600px]">
                  <thead className="bg-[#fdfbf7] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                    <tr>
                      <th className="px-5 py-3">Order ID</th>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-semibold text-gray-700">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-gray-400">No orders placed by this customer.</td>
                      </tr>
                    ) : (
                      orders.map((o: any) => (
                        <tr key={o.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3 font-mono text-[10px]">#{o.id.slice(-8).toUpperCase()}</td>
                          <td className="px-5 py-3 text-gray-500">{new Date(o.created_at).toLocaleDateString()}</td>
                          <td className="px-5 py-3 text-gray-900 font-bold font-mono">₹{Number(o.total_amount).toFixed(2)}</td>
                          <td className="px-5 py-3">
                            <Badge variant="outline" className="capitalize text-[8px] font-bold">
                              {o.status}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => window.open(`/admin/orders/${o.id}`, '_blank')}
                              className="h-7 w-7 text-[#1a3b2b] hover:bg-gray-100"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Review ledger */}
          <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl shadow-sm">
            <CardHeader className="border-b border-[#1a3b2b]/5 px-6 py-4">
              <CardTitle className="font-serif text-[#5c2018] text-lg font-bold flex items-center gap-2">
                <Star className="h-5 w-5 text-[#1a3b2b]" />
                Customer Product Reviews
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left min-w-[600px]">
                  <thead className="bg-[#fdfbf7] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                    <tr>
                      <th className="px-5 py-3">Food Item</th>
                      <th className="px-5 py-3">Rating</th>
                      <th className="px-5 py-3">Comment Summary</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Featured</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-semibold text-gray-700">
                    {reviews.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-gray-400">No product reviews submitted.</td>
                      </tr>
                    ) : (
                      reviews.map((r: any) => (
                        <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3 text-gray-900 font-bold">{r.food_items?.name || 'Delicacy'}</td>
                          <td className="px-5 py-3 text-amber-500 font-bold flex items-center">
                            {r.rating} <Star className="h-3 w-3 fill-amber-500 text-amber-500 ml-1 shrink-0" />
                          </td>
                          <td className="px-5 py-3 text-gray-500 max-w-xs truncate font-medium">
                            {r.comment || <span className="italic text-gray-300">No comment text</span>}
                          </td>
                          <td className="px-5 py-3">
                            <Badge variant="outline" className={`capitalize text-[8px] font-bold ${
                              r.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                              r.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-red-50 text-red-700 border-red-200'
                            }`}>
                              {r.status}
                            </Badge>
                          </td>
                          <td className="px-5 py-3">
                            {r.is_featured ? (
                              <Badge className="bg-amber-100 text-amber-800 border-none font-bold text-[8px] uppercase">
                                Yes
                              </Badge>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Activity timeline feed */}
          <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl shadow-sm">
            <CardHeader className="border-b border-[#1a3b2b]/5 px-6 py-4">
              <CardTitle className="font-serif text-[#5c2018] text-lg font-bold flex items-center gap-2">
                <Activity className="h-5 w-5 text-[#1a3b2b]" />
                Customer Activity Logs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {activities.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-4">No logged activity timeline records.</p>
              ) : (
                <div className="relative border-l border-gray-100 ml-3 space-y-4 py-1.5">
                  {activities.map((act: any) => (
                    <div key={act.id} className="relative pl-5">
                      <span className="absolute -left-[4px] top-1.5 h-1.5 w-1.5 rounded-full bg-[#1a3b2b]" />
                      <div className="text-xs">
                        <span className="font-bold text-gray-900 capitalize">
                          {act.activity_type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-gray-400 font-medium"> on </span>
                        <span className="text-gray-500 font-semibold">{new Date(act.created_at).toLocaleString()}</span>
                        {act.description && (
                          <p className="text-gray-600 mt-0.5 font-medium italic">"{act.description}"</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit note dialog */}
      <Dialog open={isEditNoteOpen} onOpenChange={setIsEditNoteOpen}>
        <DialogContent className="w-[92vw] max-h-[90vh] overflow-y-auto sm:max-w-md bg-white rounded-2xl border border-gray-100 p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-[#5c2018] text-xl font-bold">Edit Customer Note</DialogTitle>
            <DialogDescription className="text-gray-400">
              Modify the administrative customer note content.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-note" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Note Content</Label>
              <Textarea
                id="edit-note"
                value={editingNoteText}
                onChange={(e) => setEditingNoteText(e.target.value)}
                className="rounded-xl border-gray-200 text-xs h-32"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsEditNoteOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleSaveEditNote} className="bg-[#1a3b2b] text-[#d4af37] hover:bg-[#122b20] rounded-xl font-bold">
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createNotification } from '@/lib/admin/notifications';
import {
  ArrowLeft,
  Truck,
  DollarSign,
  User,
  MapPin,
  Clipboard,
  Clock,
  Plus,
  RefreshCw,
  Edit,
  Trash2,
  Ticket,
} from 'lucide-react';
import { toast } from 'sonner';
import { auditService } from '@/shared/services/auditService';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { useOrderDetails } from '@/shared/hooks/useOrderDetails';
import { useUpdateOrderStatus } from '@/shared/hooks/useUpdateOrderStatus';
import { useOrderNotes } from '@/shared/hooks/useOrderNotes';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface OrderDetail {
  id: string;
  total_amount: number;
  status: string | null;
  payment_status: string | null;
  created_at: string;
  updated_at: string;
  notes: string | null;
  user_id: string | null;
  tracking_number?: string | null;
  courier_partner?: string | null;
  dispatch_date?: string | null;
  packed_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  addresses: {
    full_name: string;
    phone: string;
    address_line1: string;
    address_line2: string | null;
    city: string;
    state: string;
    pincode: string;
  } | null;
  order_items: {
    id: string;
    quantity: number;
    unit_price: number;
    subtotal: number | null;
    product_name_snapshot: string | null;
    variant_name_snapshot: string | null;
    food_items: {
      name: string;
      image_url: string | null;
    } | null;
  }[];
}

interface OrderNote {
  id: string;
  note: string;
  created_at: string;
  admin_id?: string | null;
  profiles?: {
    full_name: string | null;
  } | null;
}

interface StatusHistory {
  id: string;
  old_status: string | null;
  new_status: string | null;
  changed_at: string;
  notes: string | null;
  changed_by?: string | null;
  profiles?: {
    full_name: string | null;
  } | null;
}

interface Refund {
  id: string;
  amount: number;
  reason: string | null;
  status: string;
  created_at: string;
}

const formatStatus = (status: string | null) => {
  if (!status) return 'Pending';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

export default function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();

  // Form states
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [newNote, setNewNote] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  // Tracking inputs (pre-filled on load)
  const [trackingNumber, setTrackingNumber] = useState('');
  const [courierPartner, setCourierPartner] = useState('');
  const [dispatchDate, setDispatchDate] = useState('');

  // CRUD Editing Note state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [isEditNoteOpen, setIsEditNoteOpen] = useState(false);

  // React Query queries/mutations
  const { data: rawOrder, isLoading: detailsLoading, refetch: refetchOrderDetails } = useOrderDetails(id);
  const updateStatusMutation = useUpdateOrderStatus();
  const createNoteMutation = useOrderNotes();

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase
        .from('order_notes')
        .delete()
        .eq('id', noteId);
      if (error) throw error;
    },
    onSuccess: (_, noteId) => {
      auditService.log('delete_note', 'order', id!, { deleted_note_id: noteId }, null);
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      toast.success('Staff note deleted successfully');
    },
    onError: (err: any) => {
      toast.error(`Note delete failed: ${err.message}`);
    }
  });

  const updateNoteMutation = useMutation({
    mutationFn: async (variables: { noteId: string; noteText: string }) => {
      const { error } = await supabase
        .from('order_notes')
        .update({ note: variables.noteText })
        .eq('id', variables.noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      toast.success('Staff note updated successfully');
      setIsEditNoteOpen(false);
      setEditingNoteId(null);
      setEditingNoteText('');
    },
    onError: (err: any) => {
      toast.error(`Note edit failed: ${err.message}`);
    }
  });

  const refundMutation = useMutation({
    mutationFn: async (variables: { amount: number; reason: string }) => {
      const { error } = await supabase
        .from('order_refunds')
        .insert({
          order_id: id as string,
          amount: variables.amount,
          reason: variables.reason || null,
          status: 'approved', // Auto-approved in this flow
          approved_by: user?.id || null
        });
      if (error) throw error;
    },
    onSuccess: async (_, variables) => {
      await createNotification(
        order?.user_id || '',
        'Refund Approved',
        `A refund of ₹${variables.amount.toFixed(2)} for your order #${id?.slice(-8).toUpperCase()} has been approved.`,
        'order'
      );

      await auditService.log(
        'refund',
        'order',
        id!,
        null,
        { amount: variables.amount, reason: variables.reason }
      );

      queryClient.invalidateQueries({ queryKey: ['order', id] });
      toast.success('Refund transaction processed successfully!');
      setRefundAmount('');
      setRefundReason('');
    },
    onError: (err: any) => {
      toast.error(`Refund failed: ${err.message}`);
    }
  });

  useEffect(() => {
    if (rawOrder) {
      setNewStatus(rawOrder.status || 'pending');
      setTrackingNumber(rawOrder.tracking_number || '');
      setCourierPartner(rawOrder.courier_partner || '');
      if (rawOrder.dispatch_date) {
        setDispatchDate(new Date(rawOrder.dispatch_date).toISOString().slice(0, 16));
      } else {
        setDispatchDate('');
      }
    }
  }, [rawOrder]);

  if (detailsLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-2">
        <RefreshCw className="h-8 w-8 text-[#1a3b2b] animate-spin" />
        <span className="text-sm text-gray-500 font-medium">Fetching order records...</span>
      </div>
    );
  }

  if (!rawOrder) return null;

  // Format relation data
  const order: OrderDetail = {
    id: rawOrder.id,
    total_amount: rawOrder.total_amount,
    status: rawOrder.status,
    payment_status: rawOrder.payment_status,
    created_at: rawOrder.created_at,
    updated_at: rawOrder.updated_at,
    notes: rawOrder.notes,
    user_id: rawOrder.user_id,
    tracking_number: rawOrder.tracking_number,
    courier_partner: rawOrder.courier_partner,
    dispatch_date: rawOrder.dispatch_date,
    packed_at: rawOrder.packed_at,
    shipped_at: rawOrder.shipped_at,
    delivered_at: rawOrder.delivered_at,
    addresses: rawOrder.addresses,
    order_items: rawOrder.order_items || []
  };

  const notes: OrderNote[] = rawOrder.order_notes || [];
  const history: StatusHistory[] = rawOrder.order_status_history || [];
  const refunds: Refund[] = rawOrder.order_refunds || [];
  
  const appliedCoupon = rawOrder.coupon_redemptions?.[0]
    ? {
        code: rawOrder.coupon_redemptions[0].coupons?.code || 'COUPON',
        type: rawOrder.coupon_redemptions[0].coupons?.type || 'flat',
        value: Number(rawOrder.coupon_redemptions[0].coupons?.value || 0)
      }
    : null;

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    try {
      const oldStatus = order.status;
      const nowString = new Date().toISOString();

      const updates: Record<string, unknown> = {
        status: newStatus,
        tracking_number: trackingNumber || null,
        courier_partner: courierPartner || null,
        dispatch_date: dispatchDate ? new Date(dispatchDate).toISOString() : null,
        updated_at: nowString
      };

      if (newStatus === 'packed' && !order.packed_at) {
        updates.packed_at = nowString;
      } else if (newStatus === 'shipped' && !order.shipped_at) {
        updates.shipped_at = nowString;
        if (!updates.dispatch_date) {
          updates.dispatch_date = nowString;
        }
      } else if (newStatus === 'delivered' && !order.delivered_at) {
        updates.delivered_at = nowString;
      }

      await updateStatusMutation.mutateAsync({
        orderId: order.id,
        updates,
        notes: statusNotes || `Fulfillment details updated to ${newStatus}`,
        changedBy: user?.id || ''
      });

      if (newStatus === 'packed') {
        await createNotification(
          order.user_id || '',
          'Order Packed',
          `Your order #${order.id.slice(-8).toUpperCase()} has been packed and is ready for dispatch!`,
          'order'
        );
      } else if (newStatus === 'shipped') {
        await createNotification(
          order.user_id || '',
          'Order Shipped',
          `Your order #${order.id.slice(-8).toUpperCase()} has been shipped! tracking number: ${trackingNumber || 'N/A'} via ${courierPartner || 'N/A'}.`,
          'order'
        );
      } else if (newStatus === 'delivered') {
        await createNotification(
          order.user_id || '',
          'Order Delivered',
          `Your order #${order.id.slice(-8).toUpperCase()} has been delivered successfully. Enjoy your Aayish Foods delicacies!`,
          'order'
        );
      }

      await auditService.log(
        'status_update',
        'order',
        order.id,
        { status: oldStatus },
        { status: newStatus, tracking_number: trackingNumber, courier_partner: courierPartner }
      );

      toast.success('Order status updated successfully');
      setStatusNotes('');
    } catch (err: any) {
      toast.error(`Status update failed: ${err.message}`);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      await createNoteMutation.mutateAsync({
        orderId: id!,
        adminId: user?.id || '',
        note: newNote
      });

      await auditService.log(
        'create_note',
        'order',
        id!,
        null,
        { note: newNote }
      );

      toast.success('Staff note recorded successfully');
      setNewNote('');
    } catch (err: any) {
      toast.error(`Note addition failed: ${err.message}`);
    }
  };

  const handleOpenEditNote = (note: OrderNote) => {
    setEditingNoteId(note.id);
    setEditingNoteText(note.note);
    setIsEditNoteOpen(true);
  };

  const handleSaveEditNote = () => {
    if (!editingNoteText.trim() || !editingNoteId) return;
    updateNoteMutation.mutate({ noteId: editingNoteId, noteText: editingNoteText });
  };

  const handleDeleteNote = (noteId: string) => {
    confirm({
      title: 'Delete Staff Note',
      message: 'Are you sure you want to delete this staff note? This action cannot be undone.',
      confirmText: 'Delete Note',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: async () => {
        deleteNoteMutation.mutate(noteId);
      }
    });
  };

  const handleProcessRefund = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(refundAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid refund amount');
      return;
    }

    confirm({
      title: 'Process Refund Transaction',
      message: `Are you sure you want to approve and process a refund of ₹${amt.toFixed(2)} for this order? This will create an approved transaction and notify the customer.`,
      confirmText: 'Approve & Process',
      cancelText: 'Cancel',
      variant: 'warning',
      onConfirm: async () => {
        refundMutation.mutate({ amount: amt, reason: refundReason });
      }
    });
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'confirmed':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'preparing':
        return 'bg-orange-50 text-orange-800 border-orange-200';
      case 'packed':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'shipped':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'delivered':
        return 'bg-green-50 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-red-50 text-red-800 border-red-200';
      case 'returned':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'refunded':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      case 'payment_review':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      default:
        return 'bg-gray-50 text-gray-800 border-gray-200';
    }
  };

  const isMutating = updateStatusMutation.isPending || createNoteMutation.isPending || deleteNoteMutation.isPending || updateNoteMutation.isPending || refundMutation.isPending;

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/orders')} className="hover:bg-gray-100 shrink-0">
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </Button>
          <div>
            <h1 className="font-serif text-3xl font-bold text-[#5c2018]">Order #{order.id.slice(-8).toUpperCase()}</h1>
            <p className="text-gray-500 text-sm mt-1">Placed on {new Date(order.created_at).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Order items, tracking, history & notes */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl overflow-hidden shadow-sm">
            <CardHeader className="border-b border-[#1a3b2b]/5 px-6 py-4">
              <CardTitle className="font-serif text-[#5c2018] text-lg font-bold flex items-center gap-2">
                <Clipboard className="h-5 w-5 text-[#1a3b2b]" />
                Purchased Delicacies
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100">
                {order.order_items.map((item) => (
                  <div key={item.id} className="p-6 flex items-center justify-between gap-4">
                    <div className="flex items-center space-x-4">
                      <div className="h-12 w-12 rounded-xl overflow-hidden border border-gray-100 bg-[#fdfbf7] shrink-0">
                        <img src={item.food_items?.image_url || '/placeholder.svg'} alt={item.product_name_snapshot || item.food_items?.name || ''} className="h-full w-full object-cover" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 leading-tight">
                          {item.product_name_snapshot || item.food_items?.name || 'Unknown item'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          ₹{Number(item.unit_price).toFixed(2)} x {item.quantity} 
                          <span className="text-muted-foreground ml-1">({item.variant_name_snapshot || 'Standard'})</span>
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-gray-900">₹{(item.unit_price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Coupon Detail displays */}
              {appliedCoupon && (
                <div className="px-6 py-3 bg-amber-50/50 border-t border-b border-amber-100 flex items-center justify-between text-xs text-amber-900">
                  <div className="flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-[#d4af37]" />
                    <span className="font-bold font-mono border border-dashed border-[#d4af37]/40 px-2 py-0.5 rounded bg-white">
                      {appliedCoupon.code}
                    </span>
                    <span className="text-gray-500 capitalize">({appliedCoupon.type} campaign)</span>
                  </div>
                  <span className="font-bold text-[#1a3b2b]">
                    Applied Benefit: {appliedCoupon.type === 'percentage' ? `${appliedCoupon.value}% off` : `₹${appliedCoupon.value} off`}
                  </span>
                </div>
              )}

              <div className="bg-[#fdfbf7]/60 p-6 flex flex-col items-end border-t border-gray-100 text-sm">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal</span>
                    <span>₹{Number(order.total_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Tax (GST)</span>
                    <span>Included</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Shipping Fee</span>
                    <span>₹0.00</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-200">
                    <span>Total Amount</span>
                    <span>₹{Number(order.total_amount).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fulfillment SLA Timestamps */}
          {(order.packed_at || order.shipped_at || order.delivered_at) && (
            <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl shadow-sm">
              <CardHeader className="border-b border-[#1a3b2b]/5 px-6 py-4">
                <CardTitle className="font-serif text-[#5c2018] text-lg font-bold flex items-center gap-2">
                  <Truck className="h-5 w-5 text-[#1a3b2b]" />
                  Fulfillment Metrics & Logs
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                <div className="p-3 bg-[#fdfbf7] rounded-xl border border-gray-100">
                  <p className="text-[9px]">Packed At</p>
                  <p className="text-gray-800 mt-1 font-bold font-mono">
                    {order.packed_at ? new Date(order.packed_at).toLocaleString() : 'N/A'}
                  </p>
                </div>
                <div className="p-3 bg-[#fdfbf7] rounded-xl border border-gray-100">
                  <p className="text-[9px]">Shipped At</p>
                  <p className="text-gray-800 mt-1 font-bold font-mono">
                    {order.shipped_at ? new Date(order.shipped_at).toLocaleString() : 'N/A'}
                  </p>
                </div>
                <div className="p-3 bg-[#fdfbf7] rounded-xl border border-gray-100">
                  <p className="text-[9px]">Delivered At</p>
                  <p className="text-gray-800 mt-1 font-bold font-mono">
                    {order.delivered_at ? new Date(order.delivered_at).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Chronological Status History */}
          <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl shadow-sm">
            <CardHeader className="border-b border-[#1a3b2b]/5 px-6 py-4">
              <CardTitle className="font-serif text-[#5c2018] text-lg font-bold flex items-center gap-2">
                <Clock className="h-5 w-5 text-[#1a3b2b]" />
                Fulfillment Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {history.length === 0 ? (
                <p className="text-center py-4 text-xs text-gray-400">No status changes logged.</p>
              ) : (
                <div className="relative border-l border-gray-200 ml-4 space-y-6 py-2">
                  {history.map((hist) => (
                    <div key={hist.id} className="relative pl-6">
                      <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-[#1a3b2b]" />
                      <div className="text-xs">
                        <span className="font-bold text-gray-900 capitalize">
                          {formatStatus(hist.old_status)} → {formatStatus(hist.new_status)}
                        </span>
                        <span className="text-gray-400"> on </span>
                        <span className="text-gray-500">{new Date(hist.changed_at).toLocaleString()}</span>
                        <p className="text-gray-600 mt-1 italic font-medium">"{hist.notes || 'No description notes'}"</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">By {hist.profiles?.full_name || 'System'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Internal Notes with full CRUD actions */}
          <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl shadow-sm">
            <CardHeader className="border-b border-[#1a3b2b]/5 px-6 py-4">
              <CardTitle className="font-serif text-[#5c2018] text-lg font-bold flex items-center gap-2">
                <Clipboard className="h-5 w-5 text-[#1a3b2b]" />
                Support Staff Logs (Internal Only)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <form onSubmit={handleAddNote} className="space-y-3">
                <Label htmlFor="order-note" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Add Internal Note</Label>
                <Textarea
                  id="order-note"
                  placeholder="Record customer preferences, delivery alerts, packaging details..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="rounded-xl border-gray-200 text-xs"
                />
                <Button type="submit" className="bg-[#1a3b2b] hover:bg-[#122b20] text-[#d4af37] text-xs h-9 font-bold" disabled={isMutating}>
                  Record Note
                </Button>
              </form>

              <div className="divide-y divide-gray-100 border-t border-gray-100 pt-4">
                {notes.length === 0 ? (
                  <p className="text-center py-4 text-xs text-gray-400">No support notes recorded yet.</p>
                ) : (
                  notes.map((note) => (
                    <div key={note.id} className="py-3 flex justify-between items-start gap-4">
                      <div className="text-xs space-y-1">
                        <div className="flex items-center gap-2 text-gray-400 font-bold uppercase text-[9px]">
                          <span>{note.profiles?.full_name || 'System staff'}</span>
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
                          className="h-7 w-7 text-blue-600 hover:bg-blue-50"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteNote(note.id)}
                          className="h-7 w-7 text-red-600 hover:bg-red-50"
                          disabled={isMutating}
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

        {/* Right 1 Col: Customer Address & Status management */}
        <div className="space-y-6">
          {/* Customer Card */}
          <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl shadow-sm">
            <CardHeader className="border-b border-[#1a3b2b]/5 px-6 py-4">
              <CardTitle className="font-serif text-[#5c2018] text-lg font-bold flex items-center gap-2">
                <User className="h-5 w-5 text-[#1a3b2b]" />
                Client Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4 text-xs font-medium text-gray-700">
              <div className="flex items-center space-x-3">
                <MapPin className="h-5 w-5 text-[#5c2018] shrink-0" />
                <div>
                  <p className="font-bold text-gray-900">{order.addresses?.full_name || 'No address name'}</p>
                  <p className="text-gray-500 mt-0.5">{order.addresses?.phone || 'No phone number'}</p>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-3 space-y-1 text-gray-500 font-medium">
                <p>{order.addresses?.address_line1}</p>
                {order.addresses?.address_line2 && <p>{order.addresses.address_line2}</p>}
                <p>
                  {order.addresses?.city}, {order.addresses?.state} - {order.addresses?.pincode}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Status update widget */}
          <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl shadow-sm">
            <CardHeader className="border-b border-[#1a3b2b]/5 px-6 py-4">
              <CardTitle className="font-serif text-[#5c2018] text-lg font-bold flex items-center gap-2">
                <Truck className="h-5 w-5 text-[#1a3b2b]" />
                Fulfillment Management
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleUpdateStatus} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="order-status-select" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Fulfillment Status</Label>
                  <select
                    id="order-status-select"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full h-11 px-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#1a3b2b]"
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="preparing">Preparing (Processing)</option>
                    <option value="packed">Packed</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="returned">Returned</option>
                    <option value="refunded">Refunded</option>
                    <option value="payment_review">Payment Review</option>
                  </select>
                </div>

                {/* Show tracking inputs for shipped state */}
                {(newStatus === 'shipped' || order.status === 'shipped') && (
                  <div className="space-y-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Shipment Metadata</span>
                    
                    <div className="space-y-1">
                      <Label htmlFor="courier-partner" className="text-[10px] font-bold text-gray-500 uppercase">Courier Partner</Label>
                      <Input
                        id="courier-partner"
                        placeholder="e.g. Delhivery, BlueDart"
                        value={courierPartner}
                        onChange={(e) => setCourierPartner(e.target.value)}
                        className="rounded-lg h-9 bg-white border-gray-200 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="tracking-number" className="text-[10px] font-bold text-gray-500 uppercase">Tracking Number</Label>
                      <Input
                        id="tracking-number"
                        placeholder="e.g. AAY-98247923"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        className="rounded-lg h-9 bg-white border-gray-200 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="dispatch-date" className="text-[10px] font-bold text-gray-500 uppercase">Dispatch Date & Time</Label>
                      <Input
                        id="dispatch-date"
                        type="datetime-local"
                        value={dispatchDate}
                        onChange={(e) => setDispatchDate(e.target.value)}
                        className="rounded-lg h-9 bg-white border-gray-200 text-xs"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="status-note" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status Timeline Notes</Label>
                  <Input
                    id="status-note"
                    placeholder="e.g. Packing completed, tracking id set"
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                    className="rounded-xl border-gray-200 h-10 text-xs"
                  />
                </div>

                <Button type="submit" className="bg-[#1a3b2b] hover:bg-[#122b20] text-[#d4af37] font-semibold w-full h-11 rounded-xl" disabled={isMutating}>
                  {isMutating ? 'Updating...' : 'Update Order Details'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Refund Manager */}
          <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl shadow-sm">
            <CardHeader className="border-b border-[#1a3b2b]/5 px-6 py-4">
              <CardTitle className="font-serif text-[#5c2018] text-lg font-bold flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-red-600" />
                Refunding Processing
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <form onSubmit={handleProcessRefund} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="refund-amount" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Refund Amount (₹)</Label>
                  <Input
                    id="refund-amount"
                    type="number"
                    placeholder="e.g. 150"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="rounded-xl border-gray-200 h-10 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="refund-reason" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Reason for Refund</Label>
                  <Input
                    id="refund-reason"
                    placeholder="e.g. Item returned, batch replacement"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="rounded-xl border-gray-200 h-10 text-xs"
                  />
                </div>

                <Button type="submit" variant="destructive" className="w-full h-11 rounded-xl font-bold" disabled={isMutating}>
                  Process Return Refund
                </Button>
              </form>

              {refunds.length > 0 && (
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Refunds Record</span>
                  {refunds.map((ref) => (
                    <div key={ref.id} className="flex justify-between items-center text-xs bg-red-50/50 p-2.5 rounded-lg border border-red-100">
                      <div>
                        <p className="font-bold text-gray-900">₹{Number(ref.amount).toFixed(2)}</p>
                        <p className="text-[10px] text-gray-500">{ref.reason || 'No reason set'}</p>
                      </div>
                      <Badge className="bg-red-100 text-red-800 border-none capitalize text-[8px]">{ref.status}</Badge>
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
        <DialogContent className="max-w-md bg-[#fdfbf7] border border-[#1a3b2b]/10 rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-[#5c2018] text-xl font-bold">Edit Staff Note</DialogTitle>
            <DialogDescription>Update note content recorded in logs.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Textarea
              value={editingNoteText}
              onChange={(e) => setEditingNoteText(e.target.value)}
              className="rounded-xl border-gray-200 text-xs"
              placeholder="Note content..."
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditNoteOpen(false)} className="rounded-lg text-xs h-9" disabled={isMutating}>
                Cancel
              </Button>
              <Button onClick={handleSaveEditNote} className="bg-[#1a3b2b] text-[#d4af37] text-xs h-9 font-bold rounded-lg" disabled={isMutating}>
                Save Note Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Warehouse,
  Boxes,
  ArrowRightLeft,
  AlertTriangle,
  History,
  Plus,
  RefreshCw,
  Search,
  Check,
  X,
  Edit,
  Trash2,
  Info,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useInventoryList, useInventoryStatusCounts } from '@/shared/hooks/useInventoryList';
import { useWarehousesList } from '@/shared/hooks/useWarehousesList';
import { useActiveVariants } from '@/shared/hooks/useActiveVariants';
import { useInventoryMovements } from '@/shared/hooks/useInventoryMovements';
import { useSaveWarehouse } from '@/shared/hooks/useSaveWarehouse';
import { useDeleteWarehouse } from '@/shared/hooks/useDeleteWarehouse';
import { useUpdateStock } from '@/shared/hooks/useUpdateStock';
import { useTransferStock } from '@/shared/hooks/useTransferStock';

const mapLedgerItem = (item: any) => ({
  id: item.id,
  warehouse_id: item.warehouse_id,
  variant_id: item.variant_id,
  quantity: item.quantity,
  reserved_stock: item.reserved_stock,
  available_stock: item.available_stock,
  reorder_level: item.reorder_level,
  created_at: item.created_at,
  warehouses: {
    name: item.warehouse_name,
    location: item.warehouse_location,
    is_active: item.warehouse_active
  },
  food_item_variants: {
    id: item.variant_id,
    name: item.variant_name,
    weight: item.variant_weight,
    price: item.variant_price,
    sku: item.variant_sku,
    food_items: {
      name: item.food_item_name
    }
  }
});


interface WarehouseItem {
  id: string;
  name: string;
  location: string | null;
  is_active: boolean;
  created_at: string;
}

interface Variant {
  id: string;
  name: string | null;
  weight: string | null;
  sku: string | null;
  food_items: {
    name: string;
  } | null;
}

interface StockItem {
  id: string;
  warehouse_id: string;
  variant_id: string;
  quantity: number;
  reserved_stock: number;
  available_stock: number;
  reorder_level: number | null;
  updated_at: string;
  warehouses: {
    id: string;
    name: string;
  } | null;
  food_item_variants: Variant | null;
}

interface MovementLog {
  id: string;
  warehouse_id: string;
  variant_id: string;
  type: 'in' | 'out' | 'adjustment' | 'transfer' | 'audit';
  quantity: number;
  reason: string | null;
  created_at: string;
  transfer_group_id: string | null;
  warehouses: {
    name: string;
  } | null;
  food_item_variants: {
    name: string | null;
    weight: string | null;
  } | null;
}

export default function AdminInventory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'ledger' | 'warehouses' | 'movements' | 'alerts'>('ledger');
  const [searchTerm, setSearchTerm] = useState('');
  const [syncing, setSyncing] = useState(false);

  // React Query Hooks & Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const { data: ledgerResponse, isLoading: isLoadingStock } = useInventoryList(currentPage, pageSize, debouncedSearch, 'all') as any;
  const { data: statusCounts } = useInventoryStatusCounts() as any;
  const { data: criticalResponse } = useInventoryList(1, 50, '', 'critical') as any;
  const { data: warningResponse } = useInventoryList(1, 50, '', 'warning') as any;

  const ledgerItems = ledgerResponse?.data || [];
  const totalCount = ledgerResponse?.count || 0;

  const criticalStock = (criticalResponse?.data || []).map(mapLedgerItem);
  const warningStock = (warningResponse?.data || []).map(mapLedgerItem);
  const filteredStock = ledgerItems.map(mapLedgerItem);

  const criticalCount = statusCounts?.criticalCount || 0;
  const warningCount = statusCounts?.warningCount || 0;

  const { data: warehouses = [], isLoading: isLoadingWarehouses } = useWarehousesList() as any;
  const { data: variants = [], isLoading: isLoadingVariants } = useActiveVariants() as any;
  const { data: movementsData, isLoading: isLoadingMovements } = useInventoryMovements(1, 30) as any;
  const movements = movementsData?.data || [];

  const saveWarehouseMutation = useSaveWarehouse();
  const deleteWarehouseMutation = useDeleteWarehouse();
  const updateStockMutation = useUpdateStock();
  const transferStockMutation = useTransferStock();

  // Warehouse CRUD states
  const [isWarehouseDialogOpen, setIsWarehouseDialogOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseItem | null>(null);
  const [warehouseName, setWarehouseName] = useState('');
  const [warehouseLocation, setWarehouseLocation] = useState('');
  const [warehouseActive, setWarehouseActive] = useState(true);

  // Movements form states
  const [moveType, setMoveType] = useState<'in' | 'out' | 'adjustment' | 'transfer' | 'audit'>('in');
  const [srcWarehouseId, setSrcWarehouseId] = useState('');
  const [destWarehouseId, setDestWarehouseId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [moveQty, setMoveQty] = useState('');
  const [reorderLvl, setReorderLvl] = useState('');
  const [moveReason, setMoveReason] = useState('');
  const [submittingMovement, setSubmittingMovement] = useState(false);

  const handleSyncLedger = async () => {
    setSyncing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['warehouses'] }),
        queryClient.invalidateQueries({ queryKey: ['activeVariants'] }),
        queryClient.invalidateQueries({ queryKey: ['inventoryMovements'] })
      ]);
      toast.success('Inventory ledger synced successfully');
    } catch (err) {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // Warehouse CRUD Actions
  const handleOpenWarehouseDialog = (wh: WarehouseItem | null = null) => {
    setSelectedWarehouse(wh);
    setWarehouseName(wh ? wh.name : '');
    setWarehouseLocation(wh ? wh.location || '' : '');
    setWarehouseActive(wh ? wh.is_active : true);
    setIsWarehouseDialogOpen(true);
  };

  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseName.trim()) {
      toast.error('Warehouse name is required');
      return;
    }

    try {
      await saveWarehouseMutation.mutateAsync({
        id: selectedWarehouse?.id,
        name: warehouseName,
        location: warehouseLocation || null,
        is_active: warehouseActive
      });
      toast.success(selectedWarehouse ? 'Warehouse details updated' : 'New warehouse registered successfully');
      setIsWarehouseDialogOpen(false);
    } catch (err) {
      const error = err as Error;
      toast.error(`Save warehouse failed: ${error.message}`);
    }
  };

  const handleDeleteWarehouse = async (whId: string) => {
    if (!confirm('Are you sure you want to delete this warehouse? This might break stock references.')) return;
    try {
      await deleteWarehouseMutation.mutateAsync(whId);
      toast.success('Warehouse deleted successfully');
    } catch (err) {
      const error = err as Error;
      toast.error(`Delete warehouse failed: ${error.message}`);
    }
  };

  // Stock Movement Processing (Double Entry Transfers)
  const handleProcessMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariantId) {
      toast.error('Product variant selection is required');
      return;
    }
    if (!srcWarehouseId) {
      toast.error('Warehouse selection is required');
      return;
    }

    const qty = parseInt(moveQty);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Quantity must be a positive integer');
      return;
    }

    setSubmittingMovement(true);
    try {
      if (moveType === 'transfer') {
        if (!destWarehouseId) {
          toast.error('Destination warehouse is required for transfer');
          setSubmittingMovement(false);
          return;
        }
        if (srcWarehouseId === destWarehouseId) {
          toast.error('Source and Destination warehouses must be different');
          setSubmittingMovement(false);
          return;
        }

        // Validate source warehouse available stock
        const { data: srcStockData, error: srcStockErr } = await supabase
          .from('warehouse_stock')
          .select('available_stock')
          .eq('warehouse_id', srcWarehouseId)
          .eq('variant_id', selectedVariantId)
          .maybeSingle();

        if (srcStockErr || !srcStockData || srcStockData.available_stock < qty) {
          toast.error(`Insufficient stock! Source warehouse only has ${srcStockData?.available_stock || 0} available.`);
          setSubmittingMovement(false);
          return;
        }

        const transferGroupId = await transferStockMutation.mutateAsync({
          srcWarehouseId,
          destWarehouseId,
          variantId: selectedVariantId,
          quantity: qty,
          reason: moveReason || `Transfer to ${warehouses.find((w: any) => w.id === destWarehouseId)?.name}`,
          adminId: user?.id || ''
        });

        toast.success(`Inventory stock transfer complete (Group ID: #${transferGroupId.slice(0, 8)})`);
      } else {
        const { data: currentStockData, error: currentStockErr } = await supabase
          .from('warehouse_stock')
          .select('available_stock')
          .eq('warehouse_id', srcWarehouseId)
          .eq('variant_id', selectedVariantId)
          .maybeSingle();

        if (moveType === 'out') {
          if (currentStockErr || !currentStockData || currentStockData.available_stock < qty) {
            toast.error('Insufficient available stock to log withdrawal');
            setSubmittingMovement(false);
            return;
          }
        }

        await updateStockMutation.mutateAsync({
          warehouseId: srcWarehouseId,
          variantId: selectedVariantId,
          changeQty: qty,
          reason: moveReason || `Fulfillment ${moveType}`,
          adminId: user?.id || '',
          type: moveType,
          reorderLevel: reorderLvl ? parseInt(reorderLvl) : undefined
        });

        toast.success(`Inventory movement registered successfully as ${moveType}`);
      }

      // Reset Form fields
      setSelectedVariantId('');
      setMoveQty('');
      setReorderLvl('');
      setMoveReason('');
    } catch (err) {
      const error = err as Error;
      toast.error(`Transaction failed: ${error.message}`);
    } finally {
      setSubmittingMovement(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);
  const loading = isLoadingStock || isLoadingWarehouses || isLoadingVariants || isLoadingMovements || syncing;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#5c2018]">Inventory & Warehouses</h1>
          <p className="text-gray-500 text-sm mt-1">
            Review variant stock counts, reorder warnings, log movements, and perform warehouse transfers.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {activeTab === 'warehouses' && (
            <Button onClick={() => handleOpenWarehouseDialog(null)} className="bg-[#1a3b2b] hover:bg-[#122b20] text-[#d4af37] font-bold rounded-xl h-11 px-5">
              <Plus className="h-5 w-5 mr-1" />
              Add Warehouse
            </Button>
          )}
          <Button onClick={handleSyncLedger} variant="outline" className="border-gray-200 bg-white hover:bg-gray-50 h-11">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Sync Ledger
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 pb-1 border-b border-gray-200">
        {[
          { label: 'Stock Ledger', value: 'ledger', icon: Boxes },
          { label: 'Warehouses', value: 'warehouses', icon: Warehouse },
          { label: 'Stock Movements & Transfers', value: 'movements', icon: ArrowRightLeft },
          { label: 'Low Stock Alerts', value: 'alerts', icon: AlertTriangle }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => {
                setActiveTab(tab.value as typeof activeTab);
                setSearchTerm('');
              }}
              className={`flex items-center space-x-2 px-4 py-3 border-b-2 text-xs font-bold uppercase tracking-wider transition-all -mb-[2px] ${
                isActive
                  ? 'border-[#1a3b2b] text-[#1a3b2b]'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{tab.label}</span>
              {tab.value === 'alerts' && (criticalStock.length > 0 || warningStock.length > 0) && (
                <Badge className="bg-red-600 text-white ml-1 text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                  {criticalStock.length + warningStock.length}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}

      {/* 1. STOCK LEDGER */}
      {activeTab === 'ledger' && (
        <div className="space-y-6">
          <div className="flex items-center space-x-3 bg-white p-4 rounded-xl border border-[#1a3b2b]/5 shadow-sm max-w-sm">
            <Search className="h-4 w-4 text-gray-400 shrink-0" />
            <Input
              placeholder="Search ledger by product, SKU, warehouse..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-none focus-visible:ring-0 p-0 text-sm h-auto bg-transparent placeholder-gray-400"
            />
          </div>

          <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl overflow-hidden shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-sm text-left min-w-[700px] md:min-w-[900px]">
                  <thead className="bg-[#fdfbf7] text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4">Variant Delicacy</th>
                      <th className="px-6 py-4">Warehouse Location</th>
                      <th className="px-6 py-4">SKU / Code</th>
                      <th className="px-6 py-4">Physical Count</th>
                      <th className="px-6 py-4">Reserved Stock</th>
                      <th className="px-6 py-4">Available Stock</th>
                      <th className="px-6 py-4">Reorder level</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-semibold text-gray-700">
                    {loading && ledgerItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-gray-400">Loading stock ledger records...</td>
                      </tr>
                    ) : filteredStock.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-gray-400">No stock entries matched query.</td>
                      </tr>
                    ) : (
                      filteredStock.map(item => {
                        const isCritical = item.available_stock <= 2;
                        const isWarning = item.reorder_level !== null && item.available_stock <= item.reorder_level && item.available_stock > 2;

                        return (
                          <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-bold text-gray-900 leading-tight">
                                {item.food_item_variants?.food_items?.name || 'Unknown Product'}
                              </p>
                              <span className="text-[10px] text-gray-400 mt-1 block">
                                Pack: {item.food_item_variants?.name} ({item.food_item_variants?.weight})
                              </span>
                            </td>
                            <td className="px-6 py-4 text-gray-700 font-medium">
                              {item.warehouses?.name || 'N/A'}
                            </td>
                            <td className="px-6 py-4 font-mono text-xs text-gray-500">
                              {item.food_item_variants?.sku || 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-gray-900">{item.quantity} units</td>
                            <td className="px-6 py-4 text-gray-400">{item.reserved_stock} holds</td>
                            <td className="px-6 py-4 text-gray-900 font-bold">{item.available_stock} units</td>
                            <td className="px-6 py-4 text-gray-500 font-mono text-xs">{item.reorder_level || 'N/A'}</td>
                            <td className="px-6 py-4">
                              {isCritical ? (
                                <Badge className="bg-red-100 text-red-800 border-none font-bold text-[8px] uppercase">Critical Alert</Badge>
                              ) : isWarning ? (
                                <Badge className="bg-amber-100 text-amber-800 border-none font-bold text-[8px] uppercase">Warning Level</Badge>
                              ) : (
                                <Badge className="bg-green-100 text-green-800 border-none font-bold text-[8px] uppercase">Healthy</Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100 bg-[#fdfbf7]/50">
                  <span className="text-xs text-gray-500 font-bold uppercase">
                    Page {currentPage} of {totalPages}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      variant="outline"
                      size="sm"
                      className="rounded-lg border-gray-200 h-8 text-xs bg-white text-gray-700 hover:bg-gray-50"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Prev
                    </Button>
                    <Button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      variant="outline"
                      size="sm"
                      className="rounded-lg border-gray-200 h-8 text-xs bg-white text-gray-700 hover:bg-gray-50"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 2. WAREHOUSES LIST */}
      {activeTab === 'warehouses' && (
        <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl overflow-hidden shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-sm text-left min-w-[700px] md:min-w-[900px]">
                <thead className="bg-[#fdfbf7] text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4">Warehouse ID</th>
                    <th className="px-6 py-4">Warehouse Name</th>
                    <th className="px-6 py-4">Physical Location</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Created Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-semibold text-gray-700">
                  {warehouses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-400">No warehouses configured in staging database.</td>
                    </tr>
                  ) : (
                    warehouses.map((wh: any) => (
                      <tr key={wh.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-gray-400">#{wh.id.slice(0, 8)}</td>
                        <td className="px-6 py-4 font-bold text-gray-900">{wh.name}</td>
                        <td className="px-6 py-4 text-gray-500 font-medium">{wh.location || 'Not Specified'}</td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className={`capitalize text-[9px] font-bold ${
                            wh.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {wh.is_active ? 'Active' : 'Disabled'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-gray-400 text-xs">{new Date(wh.created_at).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-right flex justify-end space-x-1">
                          <Button
                             size="icon"
                            variant="ghost"
                            onClick={() => handleOpenWarehouseDialog(wh)}
                            className="h-11 w-11 sm:h-8 sm:w-8 text-[#1a3b2b] hover:bg-gray-100 flex items-center justify-center shrink-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteWarehouse(wh.id)}
                            className="h-11 w-11 sm:h-8 sm:w-8 text-red-600 hover:bg-red-50 flex items-center justify-center shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
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
      )}

      {/* 3. STOCK MOVEMENTS & DOUBLE-ENTRY TRANSFERS */}
      {activeTab === 'movements' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Movement logging form */}
          <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl shadow-sm h-fit">
            <CardHeader className="border-b border-[#1a3b2b]/5 px-6 py-4">
              <CardTitle className="font-serif text-[#5c2018] text-lg font-bold flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-[#1a3b2b]" />
                Log Stock Movement
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleProcessMovement} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="movement-type" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Transaction Type</Label>
                  <select
                    id="movement-type"
                    value={moveType}
                    onChange={(e) => setMoveType(e.target.value as typeof moveType)}
                    className="w-full h-11 px-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#1a3b2b]"
                  >
                    <option value="in">Stock In (Increment)</option>
                    <option value="out">Stock Out (Withdrawal)</option>
                    <option value="adjustment">Stock Adjustment (Overwrite)</option>
                    <option value="transfer">Double-Entry Stock Transfer</option>
                    <option value="audit">Stock Audit (Verification)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="movement-variant" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Select Product Variant</Label>
                  <select
                    id="movement-variant"
                    value={selectedVariantId}
                    onChange={(e) => setSelectedVariantId(e.target.value)}
                    className="w-full h-11 px-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#1a3b2b]"
                  >
                    <option value="">-- Choose Variant --</option>
                    {variants.map((v: any) => (
                      <option key={v.id} value={v.id}>
                        {v.food_items?.name} - {v.name} ({v.weight}) [SKU: {v.sku || 'N/A'}]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="source-warehouse" className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    {moveType === 'transfer' ? 'Source Warehouse (From)' : 'Target Warehouse'}
                  </Label>
                  <select
                    id="source-warehouse"
                    value={srcWarehouseId}
                    onChange={(e) => setSrcWarehouseId(e.target.value)}
                    className="w-full h-11 px-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#1a3b2b]"
                  >
                    <option value="">-- Choose Warehouse --</option>
                    {warehouses.filter((w: any) => w.is_active).map((w: any) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                {moveType === 'transfer' && (
                  <div className="space-y-2 bg-[#fdfbf7] p-4 rounded-xl border border-dashed border-[#1a3b2b]/10 animate-slide-up">
                    <Label htmlFor="dest-warehouse" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Destination Warehouse (To)</Label>
                    <select
                      id="dest-warehouse"
                      value={destWarehouseId}
                      onChange={(e) => setDestWarehouseId(e.target.value)}
                      className="w-full h-11 px-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#1a3b2b] mt-1"
                    >
                      <option value="">-- Choose Destination --</option>
                      {warehouses.filter((w: any) => w.is_active).map((w: any) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="movement-quantity" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Quantity</Label>
                    <Input
                      id="movement-quantity"
                      type="number"
                      placeholder="e.g. 50"
                      value={moveQty}
                      onChange={(e) => setMoveQty(e.target.value)}
                      className="rounded-xl border-gray-200 h-11 text-sm bg-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reorder-lvl" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Reorder Limit</Label>
                    <Input
                      id="reorder-lvl"
                      type="number"
                      placeholder="e.g. 10"
                      value={reorderLvl}
                      disabled={moveType === 'transfer'}
                      onChange={(e) => setReorderLvl(e.target.value)}
                      className="rounded-xl border-gray-200 h-11 text-sm bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="movement-reason" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Audit / Transaction Reason</Label>
                  <Input
                    id="movement-reason"
                    placeholder="e.g. Batch loading, stock reconciliation..."
                    value={moveReason}
                    onChange={(e) => setMoveReason(e.target.value)}
                    className="rounded-xl border-gray-200 h-11 text-sm bg-white"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submittingMovement}
                  className="w-full bg-[#1a3b2b] hover:bg-[#122b20] text-[#d4af37] font-bold rounded-xl h-11"
                >
                  {submittingMovement ? 'Registering Movement...' : 'Post Inventory Movement'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Movements Timeline ledger */}
          <Card className="lg:col-span-2 bg-white border border-[#1a3b2b]/10 rounded-2xl shadow-sm overflow-hidden">
            <CardHeader className="border-b border-[#1a3b2b]/5 px-6 py-4 flex flex-row items-center justify-between">
              <CardTitle className="font-serif text-[#5c2018] text-lg font-bold flex items-center gap-2">
                <History className="h-5 w-5 text-[#1a3b2b]" />
                Recent Stock Movements Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[550px] overflow-y-auto">
              <div className="divide-y divide-gray-100">
                {movements.length === 0 ? (
                  <p className="text-center text-xs text-gray-400 py-12">No audit timeline records found.</p>
                ) : (
                  (movements as any[]).map(move => {
                    const isPositive = move.quantity > 0;
                    return (
                      <div key={move.id} className="p-5 flex justify-between items-start gap-4 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 capitalize">
                              {move.food_item_variants?.name || 'Delicacy'}
                            </span>
                            <Badge variant="outline" className={`text-[8px] font-bold uppercase ${
                              move.type === 'transfer' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                              move.type === 'adjustment' ? 'bg-orange-50 text-orange-800 border-orange-200' :
                              move.type === 'in' ? 'bg-green-50 text-green-800 border-green-200' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {move.type}
                            </Badge>
                            {move.transfer_group_id && (
                              <Badge className="bg-purple-100 text-purple-800 border-none text-[8px] font-bold uppercase font-mono">
                                TRF: #{move.transfer_group_id.slice(0, 8)}
                              </Badge>
                            )}
                          </div>
                          <p className="text-gray-400 font-semibold uppercase text-[9px]">
                            Warehouse: {move.warehouses?.name || 'N/A'} • {new Date(move.created_at).toLocaleString()}
                          </p>
                          {move.reason && <p className="text-gray-500 font-medium italic mt-1">"{move.reason}"</p>}
                        </div>

                        <span className={`font-mono font-bold text-sm shrink-0 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? `+${move.quantity}` : move.quantity} units
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 4. LOW STOCK ALERTS */}
      {activeTab === 'alerts' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Critical Alerts */}
            <Card className="bg-white border border-red-200 rounded-2xl overflow-hidden shadow-sm">
              <CardHeader className="bg-red-50/50 border-b border-red-100 px-6 py-4 flex flex-row items-center justify-between">
                <CardTitle className="font-serif text-red-900 text-base font-bold flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Critical Stock Alerts (Available &le; 2)
                </CardTitle>
                <Badge className="bg-red-600 text-white font-bold">{criticalStock.length}</Badge>
              </CardHeader>
              <CardContent className="p-0 max-h-[450px] overflow-y-auto">
                <div className="divide-y divide-gray-100">
                  {criticalStock.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-xs">
                      <Check className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      No critical stock alerts logged.
                    </div>
                  ) : (
                    criticalStock.map(item => (
                      <div key={item.id} className="p-5 flex justify-between items-center text-xs font-semibold">
                        <div>
                          <p className="font-bold text-gray-900">{item.food_item_variants?.food_items?.name} - {item.food_item_variants?.name}</p>
                          <p className="text-gray-400 font-medium uppercase text-[9px] mt-0.5">Warehouse: {item.warehouses?.name}</p>
                          <span className="text-[10px] text-gray-400 block mt-1.5 font-mono">SKU: {item.food_item_variants?.sku || 'N/A'}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-red-600 font-extrabold text-sm">{item.available_stock} units left</p>
                          <p className="text-gray-400 text-[10px] mt-1 font-mono">Reorder: {item.reorder_level || 5}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Reorder Warning Alerts */}
            <Card className="bg-white border border-amber-200 rounded-2xl overflow-hidden shadow-sm">
              <CardHeader className="bg-amber-50/50 border-b border-amber-100 px-6 py-4 flex flex-row items-center justify-between">
                <CardTitle className="font-serif text-amber-900 text-base font-bold flex items-center gap-2">
                  <Info className="h-5 w-5 text-amber-600" />
                  Warning Level (Available &le; Reorder Level)
                </CardTitle>
                <Badge className="bg-amber-600 text-white font-bold">{warningStock.length}</Badge>
              </CardHeader>
              <CardContent className="p-0 max-h-[450px] overflow-y-auto">
                <div className="divide-y divide-gray-100">
                  {warningStock.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-xs">
                      <Check className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      No stock reorder warnings pending.
                    </div>
                  ) : (
                    warningStock.map(item => (
                      <div key={item.id} className="p-5 flex justify-between items-center text-xs font-semibold">
                        <div>
                          <p className="font-bold text-gray-900">{item.food_item_variants?.food_items?.name} - {item.food_item_variants?.name}</p>
                          <p className="text-gray-400 font-medium uppercase text-[9px] mt-0.5">Warehouse: {item.warehouses?.name}</p>
                          <span className="text-[10px] text-gray-400 block mt-1.5 font-mono">SKU: {item.food_item_variants?.sku || 'N/A'}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-amber-600 font-extrabold text-sm">{item.available_stock} units left</p>
                          <p className="text-gray-400 text-[10px] mt-1 font-mono">Reorder: {item.reorder_level || 5}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Dialog open={isWarehouseDialogOpen} onOpenChange={setIsWarehouseDialogOpen}>
        <DialogContent className="w-[92vw] max-h-[90vh] overflow-y-auto sm:max-w-md bg-white rounded-2xl border border-gray-100">
          <DialogHeader>
            <DialogTitle className="font-serif text-[#5c2018] text-xl font-bold">
              {selectedWarehouse ? 'Edit Warehouse Location' : 'Register Warehouse'}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Provide names and geographical addresses for the storage facility center.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveWarehouse} className="space-y-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="wh-name" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Warehouse Name</Label>
              <Input
                id="wh-name"
                placeholder="e.g. Hyderabad Central, Guntur Hub"
                value={warehouseName}
                onChange={(e) => setWarehouseName(e.target.value)}
                className="rounded-xl border-gray-200"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="wh-loc" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Physical Address Location</Label>
              <Input
                id="wh-loc"
                placeholder="e.g. Shamshabad, Hyderabad"
                value={warehouseLocation}
                onChange={(e) => setWarehouseLocation(e.target.value)}
                className="rounded-xl border-gray-200"
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="wh-active"
                checked={warehouseActive}
                onChange={(e) => setWarehouseActive(e.target.checked)}
                className="rounded text-[#1a3b2b] focus:ring-[#1a3b2b]"
              />
              <Label htmlFor="wh-active" className="text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer">
                Warehouse is active and accepting stock
              </Label>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsWarehouseDialogOpen(false)} className="rounded-xl">Cancel</Button>
              <Button type="submit" className="bg-[#1a3b2b] text-[#d4af37] hover:bg-[#122b20] rounded-xl font-bold">
                {selectedWarehouse ? 'Update Facility' : 'Register Warehouse'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

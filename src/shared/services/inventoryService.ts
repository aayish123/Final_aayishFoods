import { supabase } from '@/integrations/supabase/client';
import { auditService } from './auditService';

export const inventoryService = {
  fetchWarehouseStock: async () => {
    const { data, error } = await supabase
      .from('warehouse_stock')
      .select(`
        *,
        warehouses (
          name,
          location,
          is_active
        ),
        food_item_variants (
          id,
          name,
          weight,
          label,
          price,
          sku,
          food_items (
            name
          )
        )
      `)
      .order('variant_id');

    if (error) throw error;
    return data || [];
  },

  fetchWarehouses: async () => {
    const { data, error } = await supabase
      .from('warehouses')
      .select('*')
      .order('name');
    if (error) throw error;
    return data || [];
  },

  saveWarehouse: async (warehouse: { id?: string; name: string; location: string | null; is_active: boolean }) => {
    if (warehouse.id) {
      const { data: oldWh } = await supabase
        .from('warehouses')
        .select('*')
        .eq('id', warehouse.id)
        .single();

      const { error } = await supabase
        .from('warehouses')
        .update({
          name: warehouse.name,
          location: warehouse.location,
          is_active: warehouse.is_active
        })
        .eq('id', warehouse.id);

      if (error) throw error;

      await auditService.log(
        'update',
        'warehouse',
        warehouse.id,
        oldWh as unknown as Record<string, unknown> | null,
        { name: warehouse.name, location: warehouse.location, is_active: warehouse.is_active }
      );
    } else {
      const { data: newWh, error } = await supabase
        .from('warehouses')
        .insert({
          name: warehouse.name,
          location: warehouse.location,
          is_active: warehouse.is_active
        })
        .select('id')
        .single();

      if (error) throw error;

      await auditService.log(
        'create',
        'warehouse',
        newWh.id,
        null,
        { name: warehouse.name, location: warehouse.location, is_active: warehouse.is_active }
      );
    }
    return true;
  },

  deleteWarehouse: async (id: string) => {
    const { error } = await supabase
      .from('warehouses')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await auditService.log('delete', 'warehouse', id, { deleted_id: id }, null);
    return true;
  },

  fetchActiveVariants: async () => {
    const { data, error } = await supabase
      .from('food_item_variants')
      .select(`
        id,
        name,
        weight,
        sku,
        food_items:food_item_id(name)
      `)
      .eq('status', 'active');

    if (error) throw error;
    return data || [];
  },

  updateStockQuantity: async (
    warehouseId: string,
    variantId: string,
    changeQty: number,
    reason: string,
    adminId: string,
    type: 'in' | 'out' | 'adjustment' | 'audit' = changeQty >= 0 ? 'in' : 'out',
    reorderLevel?: number | null
  ) => {
    const nowString = new Date().toISOString();

    const { data: stockRow } = await supabase
      .from('warehouse_stock')
      .select('id, quantity, reserved_stock, available_stock, reorder_level')
      .eq('warehouse_id', warehouseId)
      .eq('variant_id', variantId)
      .maybeSingle();

    let targetQty = changeQty;
    let targetAvail = changeQty;
    let deltaQty = changeQty;

    if (stockRow) {
      if (type === 'in') {
        targetQty = stockRow.quantity + changeQty;
        targetAvail = stockRow.available_stock + changeQty;
        deltaQty = changeQty;
      } else if (type === 'out') {
        targetQty = stockRow.quantity - changeQty;
        targetAvail = stockRow.available_stock - changeQty;
        deltaQty = -changeQty;
      } else { // adjustment or audit
        targetQty = changeQty;
        targetAvail = changeQty - stockRow.reserved_stock;
        deltaQty = changeQty;
      }

      const { error: stockErr } = await supabase
        .from('warehouse_stock')
        .update({
          quantity: Math.max(0, targetQty),
          available_stock: Math.max(0, targetAvail),
          reorder_level: reorderLevel !== undefined ? reorderLevel : stockRow.reorder_level,
          updated_at: nowString
        })
        .eq('id', stockRow.id);
      if (stockErr) throw stockErr;
    } else {
      const initQty = type === 'out' ? 0 : changeQty;
      const { error: stockErr } = await supabase
        .from('warehouse_stock')
        .insert({
          warehouse_id: warehouseId,
          variant_id: variantId,
          quantity: initQty,
          reserved_stock: 0,
          available_stock: initQty,
          reorder_level: reorderLevel !== undefined ? reorderLevel : 5
        });
      if (stockErr) throw stockErr;
    }

    const { error: moveErr } = await supabase
      .from('inventory_movements')
      .insert({
        warehouse_id: warehouseId,
        variant_id: variantId,
        type: type,
        quantity: type === 'out' ? -changeQty : changeQty,
        reason: reason || `Manual stock ${type}`,
        created_by: adminId
      });
    if (moveErr) throw moveErr;

    await auditService.log(
      type,
      'inventory',
      variantId,
      null,
      { warehouse_id: warehouseId, variant_id: variantId, quantity: deltaQty, reason }
    );

    return true;
  },

  transferStock: async (params: {
    srcWarehouseId: string;
    destWarehouseId: string;
    variantId: string;
    quantity: number;
    reason: string;
    adminId: string;
  }) => {
    const { srcWarehouseId, destWarehouseId, variantId, quantity, reason, adminId } = params;
    const nowString = new Date().toISOString();
    const transferGroupId = crypto.randomUUID();

    const { data: srcStock, error: srcStockErr } = await supabase
      .from('warehouse_stock')
      .select('id, quantity, available_stock')
      .eq('warehouse_id', srcWarehouseId)
      .eq('variant_id', variantId)
      .maybeSingle();

    if (srcStockErr) throw srcStockErr;
    if (!srcStock || srcStock.available_stock < quantity) {
      throw new Error(`Insufficient stock in source warehouse.`);
    }

    const { error: srcMoveErr } = await supabase
      .from('inventory_movements')
      .insert({
        warehouse_id: srcWarehouseId,
        variant_id: variantId,
        type: 'transfer',
        quantity: -quantity,
        reason: reason || 'Transfer',
        created_by: adminId,
        transfer_group_id: transferGroupId
      });
    if (srcMoveErr) throw srcMoveErr;

    const newSrcQty = srcStock.quantity - quantity;
    const newSrcAvail = srcStock.available_stock - quantity;
    const { error: srcStockUpdate } = await supabase
      .from('warehouse_stock')
      .update({
        quantity: newSrcQty,
        available_stock: newSrcAvail,
        updated_at: nowString
      })
      .eq('id', srcStock.id);
    if (srcStockUpdate) throw srcStockUpdate;

    const { error: destMoveErr } = await supabase
      .from('inventory_movements')
      .insert({
        warehouse_id: destWarehouseId,
        variant_id: variantId,
        type: 'transfer',
        quantity: quantity,
        reason: reason || 'Transfer',
        created_by: adminId,
        transfer_group_id: transferGroupId
      });
    if (destMoveErr) throw destMoveErr;

    const { data: destStock, error: destStockErr } = await supabase
      .from('warehouse_stock')
      .select('id, quantity, available_stock')
      .eq('warehouse_id', destWarehouseId)
      .eq('variant_id', variantId)
      .maybeSingle();

    if (destStockErr) throw destStockErr;

    if (destStock) {
      const { error: destStockUpdate } = await supabase
        .from('warehouse_stock')
        .update({
          quantity: destStock.quantity + quantity,
          available_stock: destStock.available_stock + quantity,
          updated_at: nowString
        })
        .eq('id', destStock.id);
      if (destStockUpdate) throw destStockUpdate;
    } else {
      const { error: destStockInsert } = await supabase
        .from('warehouse_stock')
        .insert({
          warehouse_id: destWarehouseId,
          variant_id: variantId,
          quantity: quantity,
          reserved_stock: 0,
          available_stock: quantity,
          reorder_level: 5
        });
      if (destStockInsert) throw destStockInsert;
    }

    await auditService.log(
      'transfer',
      'inventory',
      transferGroupId,
      { from_warehouse_id: srcWarehouseId, variant_id: variantId, quantity },
      { to_warehouse_id: destWarehouseId, variant_id: variantId, quantity, transfer_group_id: transferGroupId }
    );

    return transferGroupId;
  },

  fetchInventoryMovements: async (page: number, pageSize: number) => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from('inventory_movements')
      .select(`
        *,
        warehouses (
          name
        ),
        food_item_variants (
          id,
          name,
          weight,
          label,
          food_items (
            name
          )
        ),
        profiles:created_by (
          full_name
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { data: data || [], count: count || 0 };
  },

  fetchInventoryLedgerPaginated: async (
    page: number,
    pageSize: number,
    search: string,
    filterType: 'all' | 'critical' | 'warning' | 'healthy'
  ) => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('inventory_ledger_view' as any)
      .select('*', { count: 'exact' });

    if (search) {
      query = query.or(`variant_name.ilike.%${search}%,food_item_name.ilike.%${search}%,variant_sku.ilike.%${search}%,warehouse_name.ilike.%${search}%`);
    }

    if (filterType && filterType !== 'all') {
      query = query.eq('stock_status', filterType);
    }

    query = query.order('food_item_name', { ascending: true }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      data: data || [],
      count: count || 0
    };
  },

  fetchInventoryStatusCounts: async () => {
    const [critical, warning] = await Promise.all([
      supabase.from('inventory_ledger_view' as any).select('*', { count: 'exact', head: true }).eq('stock_status', 'critical'),
      supabase.from('inventory_ledger_view' as any).select('*', { count: 'exact', head: true }).eq('stock_status', 'warning')
    ]);
    return {
      criticalCount: critical.count || 0,
      warningCount: warning.count || 0
    };
  }
};

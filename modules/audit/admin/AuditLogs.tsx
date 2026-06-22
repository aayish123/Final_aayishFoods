import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  ShieldCheck, Search, Calendar, RefreshCw, Eye, User, FileText, ArrowRight,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
  profiles: {
    full_name: string | null;
    role: string | null;
  } | null;
}

interface AdminProfile {
  id: string;
  full_name: string | null;
}

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Pagination & Filter States
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [totalCount, setTotalCount] = useState(0);

  const [userFilter, setUserFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Detail Sheet State
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    fetchLogs();
  }, [currentPage, debouncedSearch, userFilter, actionFilter, entityFilter, startDate, endDate]);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('audit_logs_view')
        .select('*', { count: 'exact' });

      // Apply DB-level filters where applicable
      if (userFilter !== 'all') {
        query = query.eq('user_id', userFilter);
      }
      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }
      if (entityFilter !== 'all') {
        query = query.eq('entity_type', entityFilter);
      }
      if (startDate) {
        query = query.gte('created_at', new Date(startDate).toISOString());
      }
      if (endDate) {
        // Set end date to end of that day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query = query.lte('created_at', end.toISOString());
      }
      if (debouncedSearch) {
        query = query.or(`action.ilike.%${debouncedSearch}%,entity_type.ilike.%${debouncedSearch}%,entity_id.ilike.%${debouncedSearch}%,actor_name.ilike.%${debouncedSearch}%`);
      }

      // Query latest logs first (uses DESC index)
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const mapped = (data || []).map((log: any) => ({
        id: log.id,
        user_id: log.user_id,
        action: log.action,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        old_data: log.old_data,
        new_data: log.new_data,
        created_at: log.created_at,
        profiles: {
          full_name: log.actor_name,
          role: log.actor_role
        }
      }));

      setLogs(mapped);
      setTotalCount(count || 0);
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to load system logs: ' + errMsg);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .not('role', 'eq', 'user')
        .order('full_name');
      
      if (!error && data) {
        setAdmins(data);
      }
    } catch (err) {
      console.error('Error fetching admin filters:', err);
    }
  };

  const handleOpenDetail = (log: AuditLog) => {
    setSelectedLog(log);
    setIsDetailOpen(true);
  };

  const filteredLogs = logs;
  const totalPages = Math.ceil(totalCount / pageSize);

  const getActionBadgeColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'update':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'delete':
        return 'bg-rose-50 text-rose-700 border-rose-100';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#5c2018]">Recent System Logs</h1>
          <p className="text-gray-500 text-sm mt-1">Audit security trails, settings changes, updates, and database actions</p>
        </div>
        <Button 
          onClick={fetchLogs} 
          variant="outline" 
          className="border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl h-10 px-4 flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Logs
        </Button>
      </div>

      {/* Filters Card */}
      <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5 text-xs">
            {/* User Search */}
            <div className="space-y-1.5">
              <Label htmlFor="search-log" className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Text Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  id="search-log"
                  placeholder="Search actions or IDs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-gray-50/30 border-gray-200 rounded-xl text-xs h-9 focus-visible:ring-1 focus-visible:ring-[#1a3b2b]"
                />
              </div>
            </div>

            {/* Filter by User */}
            <div className="space-y-1.5">
              <Label htmlFor="user-filter" className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Actor User</Label>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger id="user-filter" className="bg-gray-50/30 border-gray-200 rounded-xl text-xs h-9 focus:ring-1 focus:ring-[#1a3b2b]">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-150">
                  <SelectItem value="all">All Administrators</SelectItem>
                  {admins.map(adm => (
                    <SelectItem key={adm.id} value={adm.id}>{adm.full_name || 'Staff'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filter by Action */}
            <div className="space-y-1.5">
              <Label htmlFor="action-filter" className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Event Action</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger id="action-filter" className="bg-gray-50/30 border-gray-200 rounded-xl text-xs h-9 focus:ring-1 focus:ring-[#1a3b2b]">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-150">
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="adjustment">Stock Adjustment</SelectItem>
                  <SelectItem value="transfer">Stock Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filter by Entity */}
            <div className="space-y-1.5">
              <Label htmlFor="entity-filter" className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Target Entity</Label>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger id="entity-filter" className="bg-gray-50/30 border-gray-200 rounded-xl text-xs h-9 focus:ring-1 focus:ring-[#1a3b2b]">
                  <SelectValue placeholder="All Entities" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-150">
                  <SelectItem value="all">All Entities</SelectItem>
                  <SelectItem value="products">products</SelectItem>
                  <SelectItem value="categories">categories</SelectItem>
                  <SelectItem value="orders">orders</SelectItem>
                  <SelectItem value="inventory">inventory</SelectItem>
                  <SelectItem value="coupons">coupons</SelectItem>
                  <SelectItem value="settings">settings</SelectItem>
                  <SelectItem value="banners">banners</SelectItem>
                  <SelectItem value="zones">zones</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date selector ranges */}
            <div className="space-y-1.5">
              <Label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Calendar Range</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-gray-50/30 border-gray-200 rounded-xl text-[10px] p-1.5 h-9 focus-visible:ring-[#1a3b2b]"
                  title="Start Date"
                />
                <span className="text-gray-400 font-bold font-mono">to</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-gray-50/30 border-gray-200 rounded-xl text-[10px] p-1.5 h-9 focus-visible:ring-[#1a3b2b]"
                  title="End Date"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table Card */}
      <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-24 text-center text-gray-400 flex flex-col items-center justify-center space-y-2">
              <RefreshCw className="h-8 w-8 animate-spin text-[#1a3b2b]" />
              <p className="text-xs font-semibold">Scanning database audit trails...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-20 text-center text-gray-400 flex flex-col items-center justify-center">
              <ShieldCheck className="h-12 w-12 text-gray-200 mb-2 stroke-1" />
              <p className="font-semibold text-sm">No Audit Logs Logged</p>
              <p className="text-xs text-gray-400 mt-0.5">Adjust filter terms or dates ranges</p>
            </div>
          ) : (
            <div className="overflow-x-auto text-xs">
              <Table>
                <TableHeader className="bg-gray-50/50">
                  <TableRow>
                    <TableHead className="font-semibold text-gray-600 px-6 py-4">Action</TableHead>
                    <TableHead className="font-semibold text-gray-600 py-4">Target Entity</TableHead>
                    <TableHead className="font-semibold text-gray-600 py-4">Entity Key ID</TableHead>
                    <TableHead className="font-semibold text-gray-600 py-4">Staff Member</TableHead>
                    <TableHead className="font-semibold text-gray-600 py-4">Role</TableHead>
                    <TableHead className="font-semibold text-gray-600 py-4">Event Date / Time</TableHead>
                    <TableHead className="font-semibold text-gray-600 text-right px-6 py-4">Inspect</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map(log => (
                    <TableRow key={log.id} className="hover:bg-gray-50/40 transition-colors font-medium">
                      <TableCell className="px-6 py-3.5">
                        <Badge variant="outline" className={`${getActionBadgeColor(log.action)} uppercase border text-[10px]`}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-[10px] text-gray-500 capitalize">
                        {log.entity_type}
                      </TableCell>
                      <TableCell className="font-mono text-[10px] text-gray-800">
                        {log.entity_id.substring(0, 18)}...
                      </TableCell>
                      <TableCell className="text-gray-900 font-bold">
                        {log.profiles?.full_name || 'System Auto'}
                      </TableCell>
                      <TableCell className="text-gray-500 capitalize">
                        {log.profiles?.role?.replace(/_/g, ' ') || 'Process'}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {new Date(log.created_at).toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell className="text-right px-6 py-3.5">
                        <Button
                          onClick={() => handleOpenDetail(log)}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-[#1a3b2b] hover:bg-[#1a3b2b]/5 rounded-lg"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100 bg-gray-50/30">
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

      {/* LOG DATA DETAILS DRAWER */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto rounded-l-2xl border-l border-gray-150 p-6 bg-white flex flex-col h-full">
          <SheetHeader className="mb-4">
            <SheetTitle className="font-serif text-xl font-bold text-gray-800 flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#1a3b2b]" /> Log Inspector: {selectedLog?.action.toUpperCase()}
            </SheetTitle>
            <SheetDescription className="text-xs text-gray-500">
              Comparing parameter changes and database variables for Entity: <b>{selectedLog?.entity_type}</b> (ID: {selectedLog?.entity_id}).
            </SheetDescription>
          </SheetHeader>

          {selectedLog && (
            <div className="flex-1 space-y-6 text-xs overflow-y-auto pr-2">
              {/* Profile Card */}
              <div className="grid grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100 font-medium">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Actor User</span>
                  <span className="text-gray-800 font-bold block mt-1">{selectedLog.profiles?.full_name || 'System'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Role scope</span>
                  <span className="text-gray-500 capitalize block mt-1">{selectedLog.profiles?.role?.replace(/_/g, ' ') || 'Admin Process'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Commit Timestamp</span>
                  <span className="text-gray-500 block mt-1">{new Date(selectedLog.created_at).toLocaleString()}</span>
                </div>
              </div>

              {/* Data Diff Viewer */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Old Data */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-gray-400 font-bold uppercase block">Previous State (Old Data)</Label>
                    <div className="bg-gray-900 text-emerald-400 font-mono text-[10px] p-4 rounded-xl overflow-x-auto max-h-[350px] border border-gray-950 shadow-inner">
                      {selectedLog.old_data ? (
                        <pre className="whitespace-pre-wrap">{JSON.stringify(selectedLog.old_data, null, 2)}</pre>
                      ) : (
                        <span className="text-gray-500 italic font-sans">No previous records logged (e.g. create event)</span>
                      )}
                    </div>
                  </div>

                  {/* New Data */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-gray-400 font-bold uppercase block">New State (Modified Data)</Label>
                    <div className="bg-gray-900 text-amber-400 font-mono text-[10px] p-4 rounded-xl overflow-x-auto max-h-[350px] border border-gray-950 shadow-inner">
                      {selectedLog.new_data ? (
                        <pre className="whitespace-pre-wrap">{JSON.stringify(selectedLog.new_data, null, 2)}</pre>
                      ) : (
                        <span className="text-gray-500 italic font-sans">No modified data logged (e.g. hard delete event)</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-gray-50 flex justify-end">
            <Button onClick={() => setIsDetailOpen(false)} className="bg-[#1a3b2b] hover:bg-[#122b1f] text-white rounded-xl shadow-md px-6 h-10 text-xs">
              Close Audit Inspector
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

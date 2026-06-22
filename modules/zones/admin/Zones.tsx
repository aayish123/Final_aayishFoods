import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  MapPin,
  Upload,
  RefreshCw,
  Search,
  Check,
  X,
  Edit,
  Trash2,
  FileText,
  AlertCircle,
  HelpCircle,
  Download
} from 'lucide-react';
import { toast } from 'sonner';

interface DeliveryZone {
  id: string;
  name: string;
  pincode: string;
  delivery_charge: number;
  min_order: number;
  is_active: boolean;
  created_at: string;
}

interface ValidationError {
  rowNumber: number;
  pincode: string;
  error: string;
}

interface ImportSummary {
  inserted: number;
  updated: number;
  failed: number;
}

export default function AdminZones() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Zone CRUD states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [zoneName, setZoneName] = useState('');
  const [pincode, setPincode] = useState('');
  const [deliveryCharge, setDeliveryCharge] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // CSV Import states
  const [importMode, setImportMode] = useState<'merge' | 'strict'>('merge');
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importErrors, setImportErrors] = useState<ValidationError[]>([]);
  const [parsing, setParsing] = useState(false);

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .order('name');
      if (error) throw error;
      setZones(data || []);
    } catch (err) {
      const error = err as Error;
      toast.error(`Error fetching delivery zones: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // CRUD Actions
  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneName.trim()) {
      toast.error('Zone name is required');
      return;
    }
    if (!pincode.trim() || pincode.length < 5) {
      toast.error('Valid pincode is required');
      return;
    }

    const charge = parseFloat(deliveryCharge);
    const minVal = parseFloat(minOrder);

    if (isNaN(charge) || charge < 0) {
      toast.error('Delivery charge must be a positive number');
      return;
    }
    if (isNaN(minVal) || minVal < 0) {
      toast.error('Minimum order must be a positive number');
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        // Update
        const { error } = await supabase
          .from('delivery_zones')
          .update({
            name: zoneName,
            pincode,
            delivery_charge: charge,
            min_order: minVal,
            is_active: isActive
          })
          .eq('id', editingId);

        if (error) throw error;
        toast.success('Delivery zone updated successfully');
      } else {
        // Check duplicate
        const { data: dup } = await supabase
          .from('delivery_zones')
          .select('id')
          .eq('pincode', pincode)
          .maybeSingle();

        if (dup) {
          toast.error(`Pincode ${pincode} is already registered in another delivery zone.`);
          setSubmitting(false);
          return;
        }

        // Insert
        const { error } = await supabase
          .from('delivery_zones')
          .insert({
            name: zoneName,
            pincode,
            delivery_charge: charge,
            min_order: minVal,
            is_active: isActive
          });

        if (error) throw error;
        toast.success('Delivery zone created successfully');
      }

      handleResetForm();
      fetchZones();
    } catch (err) {
      const error = err as Error;
      toast.error(`Failed to save zone: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (zone: DeliveryZone) => {
    setEditingId(zone.id);
    setZoneName(zone.name);
    setPincode(zone.pincode);
    setDeliveryCharge(zone.delivery_charge.toString());
    setMinOrder(zone.min_order.toString());
    setIsActive(zone.is_active);
  };

  const handleResetForm = () => {
    setEditingId(null);
    setZoneName('');
    setPincode('');
    setDeliveryCharge('');
    setMinOrder('');
    setIsActive(true);
  };

  const handleDeleteZone = async (id: string) => {
    if (!confirm('Are you sure you want to delete this delivery zone?')) return;
    try {
      const { error } = await supabase.from('delivery_zones').delete().eq('id', id);
      if (error) throw error;
      toast.success('Delivery zone deleted successfully');
      fetchZones();
    } catch (err) {
      const error = err as Error;
      toast.error(`Failed to delete zone: ${error.message}`);
    }
  };

  const handleToggleZoneStatus = async (id: string, current: boolean) => {
    try {
      const { error } = await supabase
        .from('delivery_zones')
        .update({ is_active: !current })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Zone status toggled successfully`);
      fetchZones();
    } catch (err) {
      const error = err as Error;
      toast.error(`Toggle failed: ${error.message}`);
    }
  };

  // CSV Import Validator Actions
  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setImportSummary(null);
    setImportErrors([]);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/);
        
        if (lines.length <= 1) {
          toast.error('Uploaded CSV file appears to be empty');
          setParsing(false);
          return;
        }

        let inserted = 0;
        let updated = 0;
        let failed = 0;
        const errors: ValidationError[] = [];
        const pincodesSeen = new Set<string>();
        const rowsToProcess = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue; // skip blank lines

          // Simple split by comma
          const columns = line.split(',').map(col => col.trim().replace(/^["']|["']$/g, ''));
          
          const name = columns[0] || 'Zone';
          const pin = columns[1] || '';
          const charge = parseFloat(columns[2]);
          const min = parseFloat(columns[3]);
          const active = columns[4] ? columns[4].toLowerCase() === 'true' || columns[4] === '1' : true;

          // Validations
          if (!pin) {
            errors.push({ rowNumber: i + 1, pincode: 'N/A', error: 'Pincode column is empty' });
            failed++;
            continue;
          }

          if (isNaN(charge) || charge < 0) {
            errors.push({ rowNumber: i + 1, pincode: pin, error: `Invalid delivery charge: ${columns[2]}` });
            failed++;
            continue;
          }

          if (isNaN(min) || min < 0) {
            errors.push({ rowNumber: i + 1, pincode: pin, error: `Invalid minimum order limit: ${columns[3]}` });
            failed++;
            continue;
          }

          if (pincodesSeen.has(pin)) {
            errors.push({ rowNumber: i + 1, pincode: pin, error: 'Duplicate pincode within CSV upload' });
            failed++;
            continue;
          }
          pincodesSeen.add(pin);

          rowsToProcess.push({ name, pincode: pin, delivery_charge: charge, min_order: min, is_active: active, rowNumber: i + 1 });
        }

        // Process rows sequentially
        for (const row of rowsToProcess) {
          try {
            // Check duplicate pincode in DB
            const { data: existing, error: checkErr } = await supabase
              .from('delivery_zones')
              .select('id')
              .eq('pincode', row.pincode)
              .maybeSingle();

            if (checkErr) throw checkErr;

            if (existing) {
              if (importMode === 'strict') {
                errors.push({ rowNumber: row.rowNumber, pincode: row.pincode, error: 'Pincode already registered (Strict Mode)' });
                failed++;
              } else {
                // Merge Mode: Overwrite values
                const { error: updateErr } = await supabase
                  .from('delivery_zones')
                  .update({
                    name: row.name,
                    delivery_charge: row.delivery_charge,
                    min_order: row.min_order,
                    is_active: row.is_active
                  })
                  .eq('id', existing.id);

                if (updateErr) throw updateErr;
                updated++;
              }
            } else {
              // Insert
              const { error: insertErr } = await supabase
                .from('delivery_zones')
                .insert({
                  name: row.name,
                  pincode: row.pincode,
                  delivery_charge: row.delivery_charge,
                  min_order: row.min_order,
                  is_active: row.is_active
                });

              if (insertErr) throw insertErr;
              inserted++;
            }
          } catch (dbErr) {
            const error = dbErr as Error;
            errors.push({ rowNumber: row.rowNumber, pincode: row.pincode, error: `Database write error: ${error.message}` });
            failed++;
          }
        }

        setImportSummary({ inserted, updated, failed });
        setImportErrors(errors);

        if (failed > 0) {
          toast.warning(`Import complete with errors. Inserted: ${inserted}, Updated: ${updated}, Failed: ${failed}`);
        } else {
          toast.success(`CSV Import completed successfully! Inserted: ${inserted}, Updated: ${updated}`);
        }
        
        fetchZones();
      } catch (err) {
        const error = err as Error;
        toast.error(`CSV Parsing error: ${error.message}`);
      } finally {
        setParsing(false);
      }
    };
    reader.readAsText(file);
  };

  const downloadErrorCSV = () => {
    if (importErrors.length === 0) return;
    const headers = ['Row Number', 'Pincode', 'Validation Failure Reason'];
    const rows = importErrors.map(e => [e.rowNumber, e.pincode, e.error]);
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `delivery_zones_import_errors_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Download complete for error validation CSV log');
  };

  // Searching query filter
  const filteredZones = zones.filter(z =>
    z.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    z.pincode.includes(searchTerm)
  );

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#5c2018]">Delivery Zones</h1>
          <p className="text-gray-500 text-sm mt-1">Configure pincode matching limits, delivery charges, and minimum order values</p>
        </div>
        <Button onClick={fetchZones} variant="outline" className="border-gray-200 bg-white hover:bg-gray-50">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh Zones
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Zones List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center space-x-3 bg-white p-4 rounded-xl border border-[#1a3b2b]/5 shadow-sm max-w-sm">
            <Search className="h-4 w-4 text-gray-400 shrink-0" />
            <Input
              placeholder="Search zones by name or pincode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-none focus-visible:ring-0 p-0 text-sm h-auto bg-transparent placeholder-gray-400"
            />
          </div>

          <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl overflow-hidden shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#fdfbf7] text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4">Zone Name</th>
                      <th className="px-6 py-4">Pincode</th>
                      <th className="px-6 py-4">Delivery Charge</th>
                      <th className="px-6 py-4">Min Order Amount</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-semibold text-gray-700">
                    {loading && zones.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-gray-400">Loading delivery zones...</td>
                      </tr>
                    ) : filteredZones.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-gray-400">No active delivery zones configured.</td>
                      </tr>
                    ) : (
                      filteredZones.map(zone => (
                        <tr key={zone.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 font-bold text-gray-900">{zone.name}</td>
                          <td className="px-6 py-4 font-mono text-xs text-gray-500">{zone.pincode}</td>
                          <td className="px-6 py-4 text-[#1a3b2b]">₹{Number(zone.delivery_charge).toFixed(2)}</td>
                          <td className="px-6 py-4 text-gray-700">₹{Number(zone.min_order).toFixed(2)}</td>
                          <td className="px-6 py-4">
                            <Badge
                              onClick={() => handleToggleZoneStatus(zone.id, zone.is_active)}
                              variant="outline"
                              className={`capitalize text-[9px] font-bold cursor-pointer ${
                                zone.is_active ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                              }`}
                              title="Click to toggle status"
                            >
                              {zone.is_active ? 'Active' : 'Disabled'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-right flex justify-end space-x-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEditClick(zone)}
                              className="h-8 w-8 text-[#1a3b2b] hover:bg-gray-100"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteZone(zone.id)}
                              className="h-8 w-8 text-red-600 hover:bg-red-50"
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
        </div>

        {/* Right Column: Add/Edit form + CSV Import */}
        <div className="space-y-6">
          {/* Add/Edit form */}
          <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl shadow-sm h-fit">
            <CardHeader className="border-b border-[#1a3b2b]/5 px-6 py-4">
              <CardTitle className="font-serif text-[#5c2018] text-lg font-bold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-[#1a3b2b]" />
                {editingId ? 'Edit Delivery Zone' : 'Add New Delivery Zone'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSaveZone} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="zone-name" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Zone Name</Label>
                  <Input
                    id="zone-name"
                    placeholder="e.g. Hyderabad East, Guntur Local"
                    value={zoneName}
                    onChange={(e) => setZoneName(e.target.value)}
                    className="rounded-xl border-gray-200 bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="zone-pincode" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pincode</Label>
                  <Input
                    id="zone-pincode"
                    placeholder="e.g. 500001"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="rounded-xl border-gray-200 bg-white font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="delivery-charge" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Delivery Charge (₹)</Label>
                    <Input
                      id="delivery-charge"
                      type="number"
                      placeholder="e.g. 40"
                      value={deliveryCharge}
                      onChange={(e) => setDeliveryCharge(e.target.value)}
                      className="rounded-xl border-gray-200 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="min-order" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Min Order (₹)</Label>
                    <Input
                      id="min-order"
                      type="number"
                      placeholder="e.g. 299"
                      value={minOrder}
                      onChange={(e) => setMinOrder(e.target.value)}
                      className="rounded-xl border-gray-200 bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="zone-active"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded text-[#1a3b2b] focus:ring-[#1a3b2b]"
                  />
                  <Label htmlFor="zone-active" className="text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer">Zone is active</Label>
                </div>

                <div className="flex gap-2 pt-2">
                  {editingId && (
                    <Button type="button" variant="outline" onClick={handleResetForm} className="w-1/3 rounded-xl h-11">
                      Cancel
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-[#1a3b2b] hover:bg-[#122b20] text-[#d4af37] font-bold rounded-xl h-11"
                  >
                    {editingId ? 'Update Zone' : 'Register Zone'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* CSV Bulk Import Card */}
          <Card className="bg-white border border-[#1a3b2b]/10 rounded-2xl shadow-sm h-fit">
            <CardHeader className="border-b border-[#1a3b2b]/5 px-6 py-4">
              <CardTitle className="font-serif text-[#5c2018] text-lg font-bold flex items-center gap-2">
                <Upload className="h-5 w-5 text-[#1a3b2b]" />
                CSV Bulk Import Zones
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="text-xs text-gray-500 font-medium leading-relaxed bg-[#fdfbf7] p-3.5 rounded-xl border border-gray-100">
                <span className="font-bold text-[#1a3b2b] uppercase text-[9px] block mb-1">Spreadsheet Headers Required</span>
                <code>name, pincode, delivery_charge, min_order, is_active</code>
              </div>

              {/* Mode Selectors */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Duplicate Handling Mode</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => setImportMode('merge')}
                    variant={importMode === 'merge' ? 'default' : 'outline'}
                    className={`flex-1 rounded-xl text-xs h-9 ${importMode === 'merge' ? 'bg-[#1a3b2b] text-[#d4af37] hover:bg-[#122b20]' : 'border-gray-200 bg-white text-gray-600'}`}
                  >
                    Merge (Overwrite)
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setImportMode('strict')}
                    variant={importMode === 'strict' ? 'default' : 'outline'}
                    className={`flex-1 rounded-xl text-xs h-9 ${importMode === 'strict' ? 'bg-[#1a3b2b] text-[#d4af37] hover:bg-[#122b20]' : 'border-gray-200 bg-white text-gray-600'}`}
                  >
                    Strict (Reject)
                  </Button>
                </div>
              </div>

              {/* File Uploader */}
              <div className="space-y-2">
                <Label
                  htmlFor="csv-zone-upload"
                  className={`flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-6 cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-all ${
                    parsing ? 'pointer-events-none opacity-60' : ''
                  }`}
                >
                  <Upload className="h-8 w-8 text-gray-400 stroke-1 mb-1.5" />
                  <span className="text-xs font-bold text-gray-600">{parsing ? 'Importing...' : 'Select CSV Zone File'}</span>
                </Label>
                <input
                  id="csv-zone-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleCsvImport}
                  className="hidden"
                  disabled={parsing}
                />
              </div>

              {/* Summaries & Error download */}
              {importSummary && (
                <div className="space-y-3 pt-2 animate-slide-up">
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs font-semibold text-gray-700 grid grid-cols-3 text-center gap-1">
                    <div className="text-green-700">
                      <p className="text-[10px] text-gray-400">Inserted</p>
                      <p className="text-base font-extrabold mt-0.5">{importSummary.inserted}</p>
                    </div>
                    <div className="text-blue-700">
                      <p className="text-[10px] text-gray-400">Updated</p>
                      <p className="text-base font-extrabold mt-0.5">{importSummary.updated}</p>
                    </div>
                    <div className="text-red-700">
                      <p className="text-[10px] text-gray-400">Failed</p>
                      <p className="text-base font-extrabold mt-0.5">{importSummary.failed}</p>
                    </div>
                  </div>

                  {importErrors.length > 0 && (
                    <Button
                      onClick={downloadErrorCSV}
                      variant="destructive"
                      className="w-full text-xs h-10 font-bold rounded-xl"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Error CSV Log
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

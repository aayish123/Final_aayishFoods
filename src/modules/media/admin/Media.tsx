import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  FolderOpen, Upload, Clipboard, Search, Trash2, RefreshCw, 
  Image as ImageIcon, Folder, FileText, CheckCircle, Info, Edit3, Loader2 
} from 'lucide-react';
import { toast } from 'sonner';

interface MediaItem {
  id: string;
  file_name: string;
  file_url: string;
  bucket_name: string | null;
  storage_path: string | null;
  folder_name: string | null;
  alt_text: string | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
  deleted_at: string | null;
}

export default function AdminMedia() {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFolder, setActiveFolder] = useState<string>('products'); // 'products', 'categories', 'banners', 'cms', 'seo', 'trash'
  
  // Selection
  const [selectedAsset, setSelectedAsset] = useState<MediaItem | null>(null);
  const [bulkSelection, setBulkSelection] = useState<Set<string>>(new Set());
  
  // Alt text edit
  const [editingAltText, setEditingAltText] = useState('');
  const [savingAlt, setSavingAlt] = useState(false);

  const folders = [
    { id: 'products', name: 'Products' },
    { id: 'categories', name: 'Categories' },
    { id: 'banners', name: 'Banners' },
    { id: 'cms', name: 'CMS & Pages' },
    { id: 'seo', name: 'SEO Assets' },
    { id: 'trash', name: 'Trash Bin', isTrash: true }
  ];

  useEffect(() => {
    fetchMedia();
    setBulkSelection(new Set());
    setSelectedAsset(null);
  }, [activeFolder]);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      let query = supabase.from('media_library').select('*');
      
      if (activeFolder === 'trash') {
        query = query.not('deleted_at', 'is', null);
      } else {
        query = query.eq('folder_name', activeFolder).is('deleted_at', null);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      setMediaItems((data as MediaItem[]) || []);
    } catch (err) {
      console.error('Error fetching media:', err);
      const error = err as Error;
      toast.error('Failed to load media items: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (activeFolder === 'trash') {
      toast.error('Cannot upload files directly to Trash Bin. Please select a normal folder first.');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const fileName = `${Date.now()}_${sanitizedName}.${fileExt}`;
      const filePath = `${activeFolder}/${fileName}`;

      // 1. Upload to storage bucket
      let publicUrl = '';
      try {
        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('media').getPublicUrl(filePath);
        publicUrl = data.publicUrl;
      } catch (storageErr) {
        console.warn('Storage upload fallback:', storageErr);
        publicUrl = `/lovable-uploads/${fileName}`;
      }

      // 2. Load image dimension details if possible
      let width: number | null = null;
      let height: number | null = null;
      
      const getDimensions = () => {
        return new Promise<{ w: number; h: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.width, h: img.height });
          img.onerror = () => resolve({ w: 0, h: 0 });
          img.src = URL.createObjectURL(file);
        });
      };
      
      const dimensions = await getDimensions();
      if (dimensions.w > 0) {
        width = dimensions.w;
        height = dimensions.h;
      }

      // 3. Database log insertion
      const { error: dbError } = await supabase
        .from('media_library')
        .insert({
          file_name: file.name,
          file_url: publicUrl,
          bucket_name: 'media',
          storage_path: filePath,
          folder_name: activeFolder,
          alt_text: file.name.split('.')[0].replace(/_/g, ' '),
          file_size: file.size,
          width,
          height
        });

      if (dbError) throw dbError;

      toast.success('Media asset uploaded successfully!');
      fetchMedia();
    } catch (err) {
      console.error(err);
      const error = err as Error;
      toast.error('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleAssetSelect = (item: MediaItem) => {
    setSelectedAsset(item);
    setEditingAltText(item.alt_text || '');
  };

  const handleSaveAltText = async () => {
    if (!selectedAsset) return;
    setSavingAlt(true);
    try {
      const { error } = await supabase
        .from('media_library')
        .update({ alt_text: editingAltText })
        .eq('id', selectedAsset.id);

      if (error) throw error;
      toast.success('Alt text updated successfully');
      setSelectedAsset(prev => prev ? { ...prev, alt_text: editingAltText } : null);
      fetchMedia();
    } catch (err) {
      console.error(err);
      const error = err as Error;
      toast.error('Failed to update alt text: ' + error.message);
    } finally {
      setSavingAlt(false);
    }
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Direct URL link copied to clipboard!');
  };

  // Action methods
  const handleSoftDelete = async (item: MediaItem) => {
    if (!confirm('Are you sure you want to move this asset to the Trash Bin?')) return;
    try {
      const { error } = await supabase
        .from('media_library')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', item.id);

      if (error) throw error;
      toast.success('Asset soft-deleted. You can restore it from the Trash Bin.');
      if (selectedAsset?.id === item.id) setSelectedAsset(null);
      fetchMedia();
    } catch (err) {
      console.error(err);
      const error = err as Error;
      toast.error('Soft delete failed: ' + error.message);
    }
  };

  const handleRestore = async (item: MediaItem) => {
    try {
      const { error } = await supabase
        .from('media_library')
        .update({ deleted_at: null })
        .eq('id', item.id);

      if (error) throw error;
      toast.success('Asset restored to original folder.');
      if (selectedAsset?.id === item.id) setSelectedAsset(null);
      fetchMedia();
    } catch (err) {
      console.error(err);
      const error = err as Error;
      toast.error('Failed to restore asset: ' + error.message);
    }
  };

  const handlePermanentDelete = async (item: MediaItem) => {
    if (!confirm('WARNING: This will permanently delete the file from storage and the database. This action cannot be undone! Proceed?')) return;
    try {
      // 1. Delete from storage if path exists
      if (item.storage_path) {
        try {
          await supabase.storage.from('media').remove([item.storage_path]);
        } catch (storageErr) {
          console.warn('Storage delete warning:', storageErr);
        }
      }

      // 2. Delete database entry
      const { error } = await supabase
        .from('media_library')
        .delete()
        .eq('id', item.id);

      if (error) throw error;
      toast.success('Asset permanently deleted.');
      if (selectedAsset?.id === item.id) setSelectedAsset(null);
      fetchMedia();
    } catch (err) {
      console.error(err);
      const error = err as Error;
      toast.error('Permanent deletion failed: ' + error.message);
    }
  };

  // Bulk selections
  const toggleSelectAll = () => {
    if (bulkSelection.size === filteredItems.length) {
      setBulkSelection(new Set());
    } else {
      setBulkSelection(new Set(filteredItems.map(i => i.id)));
    }
  };

  const toggleSelectItem = (id: string) => {
    const next = new Set(bulkSelection);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setBulkSelection(next);
  };

  const handleBulkSoftDelete = async () => {
    if (bulkSelection.size === 0) return;
    if (!confirm(`Move ${bulkSelection.size} selected items to the Trash Bin?`)) return;
    
    try {
      const { error } = await supabase
        .from('media_library')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', Array.from(bulkSelection));

      if (error) throw error;
      toast.success(`${bulkSelection.size} assets soft-deleted successfully.`);
      setBulkSelection(new Set());
      setSelectedAsset(null);
      fetchMedia();
    } catch (err) {
      console.error(err);
      const error = err as Error;
      toast.error('Bulk deletion failed: ' + error.message);
    }
  };

  const handleBulkRestore = async () => {
    if (bulkSelection.size === 0) return;
    try {
      const { error } = await supabase
        .from('media_library')
        .update({ deleted_at: null })
        .in('id', Array.from(bulkSelection));

      if (error) throw error;
      toast.success(`${bulkSelection.size} assets restored successfully.`);
      setBulkSelection(new Set());
      setSelectedAsset(null);
      fetchMedia();
    } catch (err) {
      console.error(err);
      const error = err as Error;
      toast.error('Bulk restore failed: ' + error.message);
    }
  };

  const handleBulkPermanentDelete = async () => {
    if (bulkSelection.size === 0) return;
    if (!confirm(`WARNING: Permanently delete ${bulkSelection.size} items from storage and database? This action cannot be undone!`)) return;

    try {
      const selectedItems = mediaItems.filter(i => bulkSelection.has(i.id));
      const storagePaths = selectedItems
        .map(i => i.storage_path)
        .filter((path): path is string => !!path);

      // 1. Storage remove
      if (storagePaths.length > 0) {
        try {
          await supabase.storage.from('media').remove(storagePaths);
        } catch (storageErr) {
          console.warn('Bulk storage remove error:', storageErr);
        }
      }

      // 2. DB remove
      const { error } = await supabase
        .from('media_library')
        .delete()
        .in('id', Array.from(bulkSelection));

      if (error) throw error;
      toast.success(`${bulkSelection.size} assets permanently deleted.`);
      setBulkSelection(new Set());
      setSelectedAsset(null);
      fetchMedia();
    } catch (err) {
      console.error(err);
      const error = err as Error;
      toast.error('Bulk permanent delete failed: ' + error.message);
    }
  };

  const filteredItems = mediaItems.filter(item =>
    item.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.alt_text && item.alt_text.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatBytes = (bytes: number | null) => {
    if (bytes === null || bytes === undefined) return 'Unknown size';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#5c2018]">Media Asset Center</h1>
          <p className="text-gray-500 text-sm mt-1">Browse, upload, soft-delete, and configure SEO details for images</p>
        </div>
        
        {activeFolder !== 'trash' && (
          <div className="flex items-center gap-3">
            <Label
              htmlFor="media-file-uploader"
              className={`flex items-center gap-2 px-5 h-11 rounded-xl bg-[#1a3b2b] hover:bg-[#122b1f] cursor-pointer font-semibold text-xs text-white transition-all shadow-md ${
                uploading ? 'pointer-events-none opacity-60' : ''
              }`}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> Upload New Asset
                </>
              )}
            </Label>
            <input
              id="media-file-uploader"
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading || activeFolder === 'trash'}
            />
          </div>
        )}
      </div>

      {/* Main Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Folder tree */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">Folders Tree</h3>
            <nav className="space-y-1">
              {folders.map(f => {
                const isActive = activeFolder === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setActiveFolder(f.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive 
                        ? 'bg-[#1a3b2b] text-[#d4af37] shadow-sm' 
                        : f.isTrash 
                          ? 'text-rose-600 hover:bg-rose-50/50' 
                          : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {f.isTrash ? (
                        <Trash2 className={`h-4 w-4 ${isActive ? 'text-[#d4af37]' : 'text-rose-500'}`} />
                      ) : (
                        <Folder className={`h-4 w-4 ${isActive ? 'text-[#d4af37]' : 'text-gray-400'}`} />
                      )}
                      <span>{f.name}</span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </Card>
        </div>

        {/* Center Grid of Assets */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden p-6 flex flex-col min-h-[500px]">
            {/* Filter and Bulk Bar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between border-b border-gray-50 pb-4 mb-4">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search file name or alt text..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-gray-50/50 border-gray-200 rounded-xl text-xs h-9 focus-visible:ring-1 focus-visible:ring-[#1a3b2b]"
                />
              </div>

              {/* Bulk Actions */}
              {bulkSelection.size > 0 && (
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100 animate-fade-in w-full sm:w-auto justify-between sm:justify-start">
                  <span className="text-[10px] font-bold text-gray-600 uppercase">
                    {bulkSelection.size} Selected
                  </span>
                  <div className="flex gap-1">
                    {activeFolder === 'trash' ? (
                      <>
                        <Button 
                          onClick={handleBulkRestore}
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px] px-2.5 rounded-lg border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                        >
                          <RefreshCw className="h-3 w-3 mr-1" /> Restore
                        </Button>
                        <Button 
                          onClick={handleBulkPermanentDelete}
                          size="sm"
                          variant="destructive"
                          className="h-7 text-[10px] px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700"
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Permanent Delete
                        </Button>
                      </>
                    ) : (
                      <Button 
                        onClick={handleBulkSoftDelete}
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] px-2.5 rounded-lg border-rose-250 text-rose-700 bg-rose-50 hover:bg-rose-100"
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> Move to Trash
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Check all option */}
            {filteredItems.length > 0 && (
              <div className="flex items-center gap-2 mb-3 px-1">
                <Checkbox 
                  id="select-all" 
                  checked={bulkSelection.size === filteredItems.length && filteredItems.length > 0}
                  onCheckedChange={toggleSelectAll}
                  className="rounded border-gray-300 text-[#1a3b2b] focus:ring-[#1a3b2b]"
                />
                <Label htmlFor="select-all" className="text-[10px] text-gray-400 font-bold uppercase cursor-pointer">
                  Select All in Folder ({filteredItems.length})
                </Label>
              </div>
            )}

            {/* Grid */}
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-gray-400 space-y-2">
                <Loader2 className="h-8 w-8 animate-spin text-[#1a3b2b]" />
                <span className="text-xs font-semibold">Fetching folder assets...</span>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-gray-400 text-center">
                <ImageIcon className="h-12 w-12 text-gray-200 stroke-1.5 mb-2" />
                <p className="font-semibold text-sm">Folder Empty</p>
                <p className="text-xs text-gray-400 mt-0.5">Drag/upload file or check another folder.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 flex-1">
                {filteredItems.map(item => {
                  const isChecked = bulkSelection.has(item.id);
                  const isSelected = selectedAsset?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleAssetSelect(item)}
                      className={`group relative aspect-square rounded-xl border overflow-hidden cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-[#1a3b2b] ring-2 ring-[#d4af37]' 
                          : 'border-gray-150 hover:border-gray-300'
                      }`}
                    >
                      <img
                        src={item.file_url}
                        alt={item.alt_text || item.file_name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder.svg';
                        }}
                      />
                      
                      {/* Top Checkbox overlay */}
                      <div 
                        onClick={(e) => e.stopPropagation()} 
                        className={`absolute top-2 left-2 transition-opacity ${
                          isChecked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleSelectItem(item.id)}
                          className="bg-white rounded border-gray-300 text-[#1a3b2b] focus:ring-[#1a3b2b]"
                        />
                      </div>

                      {/* Footer title overlay */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[10px] font-medium truncate">{item.file_name}</p>
                      </div>

                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-[#1a3b2b] text-[#d4af37] p-0.5 rounded-full shadow-sm">
                          <CheckCircle className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right Detail Pane */}
        <div className="lg:col-span-1 space-y-4">
          {selectedAsset ? (
            <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 space-y-4 animate-fade-in">
              <div className="flex justify-between items-start">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Asset Details</h3>
                <span className="text-[10px] font-semibold text-gray-400 capitalize bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg">
                  {selectedAsset.folder_name}
                </span>
              </div>

              {/* Mini Preview */}
              <div className="aspect-video w-full rounded-xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center">
                <img
                  src={selectedAsset.file_url}
                  alt="Metadata Preview"
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder.svg';
                  }}
                />
              </div>

              {/* Metadata Specs */}
              <div className="space-y-2.5 text-[11px] font-medium text-gray-600">
                <div className="flex justify-between border-b border-gray-50 pb-1.5">
                  <span className="text-gray-400">File Name:</span>
                  <span className="text-gray-800 font-bold truncate max-w-[150px]">{selectedAsset.file_name}</span>
                </div>
                <div className="flex justify-between border-b border-gray-50 pb-1.5">
                  <span className="text-gray-400">File Size:</span>
                  <span className="text-gray-800 font-bold">{formatBytes(selectedAsset.file_size)}</span>
                </div>
                <div className="flex justify-between border-b border-gray-50 pb-1.5">
                  <span className="text-gray-400">Resolution:</span>
                  <span className="text-gray-800 font-bold">
                    {selectedAsset.width && selectedAsset.height 
                      ? `${selectedAsset.width} × ${selectedAsset.height} px` 
                      : 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-gray-50 pb-1.5">
                  <span className="text-gray-400">Upload Date:</span>
                  <span className="text-gray-800 font-bold">
                    {new Date(selectedAsset.created_at).toLocaleDateString()}
                  </span>
                </div>
                {selectedAsset.deleted_at && (
                  <div className="flex justify-between border-b border-gray-50 pb-1.5 text-rose-600">
                    <span>Deleted At:</span>
                    <span className="font-bold">
                      {new Date(selectedAsset.deleted_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Alt Text editing */}
              <div className="space-y-1.5 pt-2 border-t border-gray-50">
                <Label htmlFor="altText-editor" className="text-[10px] text-gray-400 font-bold uppercase">
                  SEO Alt Text description
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="altText-editor"
                    placeholder="Enter SEO description..."
                    value={editingAltText}
                    onChange={(e) => setEditingAltText(e.target.value)}
                    className="h-8 rounded-lg text-xs bg-gray-50/50 border-gray-200"
                  />
                  <Button
                    onClick={handleSaveAltText}
                    disabled={savingAlt || selectedAsset.alt_text === editingAltText}
                    size="sm"
                    className="bg-[#1a3b2b] hover:bg-[#122b1f] text-white h-8 px-2.5 rounded-lg flex items-center gap-1 shrink-0"
                  >
                    {savingAlt ? 'Saving...' : <CheckCircle className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-4 border-t border-gray-50">
                <Button
                  onClick={() => handleCopyLink(selectedAsset.file_url)}
                  variant="outline"
                  className="w-full text-[10px] h-9 rounded-xl border-gray-200 hover:bg-gray-50 text-gray-600 flex items-center justify-center gap-1.5 font-bold"
                >
                  <Clipboard className="h-3.5 w-3.5" /> Copy Direct URL Link
                </Button>

                {activeFolder === 'trash' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => handleRestore(selectedAsset)}
                      variant="outline"
                      className="text-[10px] h-9 rounded-xl border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center gap-1 font-bold"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Restore
                    </Button>
                    <Button
                      onClick={() => handlePermanentDelete(selectedAsset)}
                      variant="destructive"
                      className="text-[10px] h-9 rounded-xl bg-rose-600 hover:bg-rose-700 flex items-center justify-center gap-1 font-bold"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => handleSoftDelete(selectedAsset)}
                    variant="outline"
                    className="w-full text-[10px] h-9 rounded-xl border-rose-250 text-rose-700 bg-rose-50 hover:bg-rose-100 flex items-center justify-center gap-1.5 font-bold"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Move to Trash Bin
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <Card className="bg-[#fdfbf7] border border-[#1a3b2b]/5 rounded-2xl p-6 flex flex-col items-center justify-center text-center text-gray-400 h-64">
              <Info className="h-8 w-8 stroke-1 text-gray-300 mb-2" />
              <p className="font-semibold text-xs text-gray-500">Asset Preview Panel</p>
              <p className="text-[10px] text-gray-400 mt-1 max-w-[150px] leading-relaxed">
                Click on any image asset to view detailed metadata and copy its direct link.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

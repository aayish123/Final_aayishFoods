import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle, DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Users, UserPlus, RefreshCw, ShieldAlert, KeyRound, 
  Mail, Shield, ToggleLeft, ToggleRight, CheckCircle2, XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { auditService } from '@/shared/services/auditService';
import { useUnsavedChangesGuard } from '@/components/system/UnsavedChangesGuard';
import { useConfirm } from '@/components/common/ConfirmDialog';


interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  is_active: boolean | null;
  created_at: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Registration Form States
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleName, setRoleName] = useState('');
  const [registering, setRegistering] = useState(false);

  // Unsaved Changes Guard
  const [isDirty, setIsDirty] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const { confirm } = useConfirm();

  useUnsavedChangesGuard(isDirty);

  // Track isInitialLoad and isDirty based on register dialog
  useEffect(() => {
    if (isRegisterOpen) {
      setIsInitialLoad(true);
      setIsDirty(false);
    } else {
      setIsDirty(false);
      window.formIsDirty = false;
    }
  }, [isRegisterOpen]);

  // Set isInitialLoad to false when dialog fields are ready/mounted
  useEffect(() => {
    if (isRegisterOpen) {
      const timer = setTimeout(() => setIsInitialLoad(false), 200);
      return () => clearTimeout(timer);
    }
  }, [fullName, email, password, roleName, isRegisterOpen]);

  // Set isDirty to true on any field update
  useEffect(() => {
    if (isRegisterOpen && !isInitialLoad) {
      setIsDirty(true);
    }
  }, [fullName, email, password, roleName]);

  useEffect(() => {
    fetchUsersData();
    fetchRoles();
  }, []);

  const fetchUsersData = async () => {
    setLoading(true);
    try {
      // Query profiles where role is not 'user' (i.e. staff members)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .not('role', 'eq', 'user')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProfiles((data as any as Profile[]) || []);
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to load administrators list: ' + errMsg);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .not('name', 'eq', 'user')
        .order('name');
      if (!error && data) {
        setRoles(data);
      }
    } catch (err) {
      console.error('Error fetching roles:', err);
    }
  };

  const handleToggleActive = async (profile: Profile) => {
    if (!currentUser) return;
    
    // Prevent self deactivation
    if (profile.id === currentUser.id) {
      toast.error('Privilege Safeguard: You cannot deactivate your own account.');
      return;
    }

    const currentStatus = profile.is_active ?? true;
    const nextStatus = !currentStatus;
    const actionLabel = nextStatus ? 'activated' : 'deactivated';

    const executeToggle = async () => {
      try {
        // 1. Update profiles table
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ is_active: nextStatus } as any)
          .eq('id', profile.id);

        if (updateError) throw updateError;

        // 2. Log change to audit log
        await auditService.log(
          'update',
          'user',
          profile.id,
          { is_active: currentStatus },
          { is_active: nextStatus }
        );

        toast.success(`Account for ${profile.full_name || profile.email} successfully ${actionLabel}.`);
        fetchUsersData(); // Reload list
      } catch (err) {
        console.error(err);
        const errMsg = err instanceof Error ? err.message : String(err);
        toast.error('Failed to alter account status: ' + errMsg);
      }
    };

    if (!nextStatus) {
      // Deactivation confirmation using styled ConfirmDialog
      confirm({
        title: 'Deactivate Administrator Account',
        message: `Are you sure you want to deactivate the account for ${profile.full_name || profile.email}? They will immediately lose access to all admin portal interfaces.`,
        confirmText: 'Deactivate Account',
        cancelText: 'Cancel',
        variant: 'danger',
        onConfirm: executeToggle
      });
    } else {
      executeToggle();
    }
  };

  const handleRegisterStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!fullName || !email || !password || !roleName) {
      toast.error('Please input all registration parameters.');
      return;
    }

    setRegistering(true);
    try {
      // 1. Invoke Edge Function (Official Supabase admin user creator)
      const { data, error: funcError } = await supabase.functions.invoke('create-admin-user', {
        body: {
          email,
          password,
          full_name: fullName,
          role_name: roleName
        }
      });

      if (funcError) throw funcError;
      if (data?.error) throw new Error(data.error);

      // 2. Audit registration action
      await auditService.log(
        'create',
        'user',
        data.userId,
        null,
        {
          email,
          full_name: fullName,
          assigned_role: roleName
        }
      );

      toast.success(`Staff user registration completed: ${fullName} is now a ${roleName.replace(/_/g, ' ')}.`);
      
      // Reset Form State
      setFullName('');
      setEmail('');
      setPassword('');
      setRoleName('');
      window.formIsDirty = false;
      setIsDirty(false);
      setIsRegisterOpen(false);
      
      fetchUsersData(); // Refresh list
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error('Staff registration failed: ' + errMsg);
    } finally {
      setRegistering(false);
    }
  };

  const getRoleBadgeColor = (role: string | null) => {
    switch (role?.toLowerCase()) {
      case 'super_admin':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'manager':
        return 'bg-[#1a3b2b]/10 text-[#1a3b2b] border-[#1a3b2b]/20';
      case 'content_manager':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'inventory_manager':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'customer_support':
        return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12 text-xs font-semibold">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#5c2018]">Admin User Controls</h1>
          <p className="text-gray-500 text-sm mt-1">Manage staff access permissions, register administrators, and activate or deactivate accounts</p>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={fetchUsersData} 
            variant="outline" 
            className="border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl h-10 px-4 flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Registry
          </Button>

          <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#1a3b2b] hover:bg-[#122b20] text-[#d4af37] font-bold rounded-xl h-10 px-4 flex items-center gap-1.5 shadow-md">
                <UserPlus className="h-4 w-4" /> Create Staff Account
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[92vw] max-h-[90vh] overflow-y-auto sm:max-w-[425px] rounded-2xl border-gray-100 p-6 bg-white">
              <form onSubmit={handleRegisterStaff} className="space-y-4">
                <DialogHeader>
                  <DialogTitle className="font-serif text-xl font-bold text-[#5c2018] flex items-center gap-2">
                    <UserPlus className="h-5 w-5 text-[#1a3b2b]" /> Register Staff Member
                  </DialogTitle>
                  <DialogDescription className="text-xs text-gray-500">
                    Create credentials and assign an administrative RBAC role. New accounts will default to active status.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3.5 pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="fullname">Full Name</Label>
                    <Input
                      id="fullname"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Aayish Dev"
                      className="border-gray-200 rounded-xl h-9 text-xs focus-visible:ring-[#1a3b2b]"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="staff@aayishfoods.com"
                        className="pl-9 border-gray-200 rounded-xl h-9 text-xs focus-visible:ring-[#1a3b2b]"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password">Initial Password</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pl-9 border-gray-200 rounded-xl h-9 text-xs focus-visible:ring-[#1a3b2b]"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="role">Assigned Staff Role</Label>
                    <Select value={roleName} onValueChange={setRoleName}>
                      <SelectTrigger id="role" className="border-gray-200 rounded-xl h-9 text-xs focus:ring-[#1a3b2b]">
                        <SelectValue placeholder="Select a staff role" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-gray-150 text-xs">
                        {roles.map(role => (
                          <SelectItem key={role.id} value={role.name}>
                            {role.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter className="pt-4 border-t border-gray-50">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsRegisterOpen(false)} 
                    className="border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs h-9"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={registering}
                    className="bg-[#1a3b2b] hover:bg-[#122b20] text-[#d4af37] font-bold rounded-xl text-xs h-9"
                  >
                    {registering ? <RefreshCw className="h-4 w-4 animate-spin mr-1.5" /> : null}
                    Create Account
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Staff ledger */}
      <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-gray-50 px-6 py-4">
          <CardTitle className="font-serif text-[#5c2018] text-lg font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-[#1a3b2b]" /> Administrators Registry
          </CardTitle>
          <CardDescription className="text-xs text-gray-500 mt-1">
            Displaying all registered staff accounts with access to the admin portal panel
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-24 text-center text-gray-400 flex flex-col items-center justify-center space-y-2">
              <RefreshCw className="h-8 w-8 animate-spin text-[#1a3b2b]" />
              <p className="text-xs font-semibold">Scanning portal user database...</p>
            </div>
          ) : profiles.length === 0 ? (
            <div className="py-20 text-center text-gray-400 flex flex-col items-center justify-center">
              <ShieldAlert className="h-12 w-12 text-gray-200 mb-2 stroke-1" />
              <p className="font-bold text-sm">No Staff Accounts Logged</p>
              <p className="text-xs text-gray-400 mt-0.5">Use the "Create Staff Account" button to add administrative staff.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="w-full min-w-max">
                <TableHeader className="bg-gray-50/50">
                  <TableRow>
                    <TableHead className="font-semibold text-gray-600 px-6 py-4">Name</TableHead>
                    <TableHead className="font-semibold text-gray-600 py-4">Email</TableHead>
                    <TableHead className="font-semibold text-gray-600 py-4">Assigned Role</TableHead>
                    <TableHead className="font-semibold text-gray-600 py-4">Joined Date</TableHead>
                    <TableHead className="font-semibold text-gray-600 py-4 text-center">Status Badge</TableHead>
                    <TableHead className="font-semibold text-gray-600 text-right px-6 py-4">Access Toggle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map(profile => {
                    const isSelf = profile.id === currentUser?.id;
                    const isActive = profile.is_active ?? true;
                    return (
                      <TableRow key={profile.id} className="hover:bg-gray-50/40 transition-colors font-medium">
                        <TableCell className="px-6 py-4 text-gray-900 font-bold">
                          {profile.full_name || 'Staff Member'}
                          {isSelf && <span className="ml-1.5 bg-[#1a3b2b]/15 text-[#1a3b2b] px-1.5 py-0.5 rounded text-[9px] font-bold">YOU</span>}
                        </TableCell>
                        <TableCell className="text-gray-500 font-mono text-[10px]">
                          {profile.email || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${getRoleBadgeColor(profile.role)} uppercase border text-[9px] font-bold`}>
                            {profile.role?.replace(/_/g, ' ') || 'Process'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-500 font-mono text-[10px]">
                          {new Date(profile.created_at).toLocaleDateString('en-IN')}
                        </TableCell>
                        <TableCell className="text-center py-4">
                          <div className="flex items-center justify-center">
                            {isActive ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100 text-[10px] font-bold">
                                <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" /> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-100 text-[10px] font-bold">
                                <XCircle className="h-3 w-3 text-rose-500 shrink-0" /> Deactivated
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right px-6 py-4">
                          <div className="flex justify-end">
                            <Switch
                              checked={isActive}
                              onCheckedChange={() => handleToggleActive(profile)}
                              disabled={isSelf}
                              title={isSelf ? 'You cannot deactivate your own profile.' : 'Toggle staff activity state'}
                              className="data-[state=checked]:bg-[#1a3b2b] data-[state=unchecked]:bg-gray-200 border-gray-150"
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

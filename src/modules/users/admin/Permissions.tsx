import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, RefreshCw, Save, X, Info, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { auditService } from '@/shared/services/auditService';


interface Role {
  id: string;
  name: string;
  description: string | null;
}

interface PermissionRecord {
  id: string;
  action: string;
  subject: string;
}

interface RolePermissionJoin {
  role_id: string;
  permission_id: string;
}

export default function AdminPermissions() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Staging state: maps roleId -> Set of permissionIds
  const [initialRolePerms, setInitialRolePerms] = useState<Record<string, Set<string>>>({});
  const [stagedRolePerms, setStagedRolePerms] = useState<Record<string, Set<string>>>({});
  
  // Selected role tab for the editor (managers/staff roles)
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Constants for standard subjects and actions to align visual grid
  const SUBJECTS = [
    'dashboard', 'products', 'categories', 'orders', 'fulfillment', 'zones', 
    'inventory', 'coupons', 'banners', 'media', 'reviews', 'reports', 'settings', 'users', 'cms', 'marketing'
  ];
  const ACTIONS = ['view', 'create', 'edit', 'delete', 'manage'];

  useEffect(() => {
    fetchMatrixData();
  }, []);

  const fetchMatrixData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Roles
      const { data: dbRoles, error: rolesErr } = await supabase
        .from('roles')
        .select('*')
        .order('name');
      if (rolesErr) throw rolesErr;

      // 2. Fetch Permissions List
      const { data: dbPerms, error: permsErr } = await supabase
        .from('permissions')
        .select('*');
      if (permsErr) throw permsErr;

      // 3. Fetch Role-Permission Mappings
      const { data: dbJoins, error: joinsErr } = await supabase
        .from('role_permissions')
        .select('*');
      if (joinsErr) throw joinsErr;

      const loadedRoles = dbRoles || [];
      setRoles(loadedRoles);
      setPermissions(dbPerms || []);

      // Set default tab to manager or first role that isn't super_admin
      const managerRole = loadedRoles.find(r => r.name === 'manager');
      const defaultRole = managerRole || loadedRoles[0];
      if (defaultRole) {
        setSelectedRoleId(defaultRole.id);
      }

      // Compile mapping lists
      const mapping: Record<string, Set<string>> = {};
      loadedRoles.forEach(r => {
        mapping[r.id] = new Set<string>();
      });

      if (dbJoins) {
        dbJoins.forEach((join: RolePermissionJoin) => {
          if (mapping[join.role_id]) {
            mapping[join.role_id].add(join.permission_id);
          }
        });
      }

      setInitialRolePerms(mapping);
      
      // Clone mapping for staging edits
      const clone: Record<string, Set<string>> = {};
      Object.keys(mapping).forEach(key => {
        clone[key] = new Set(mapping[key]);
      });
      setStagedRolePerms(clone);

    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to load permission matrix details: ' + errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Find a permissionId matching active subject and action
  const findPermissionId = (subject: string, action: string): string | null => {
    const match = permissions.find(p => p.subject === subject && p.action === action);
    return match ? match.id : null;
  };

  const handleTogglePermission = (roleId: string, subject: string, action: string) => {
    const permId = findPermissionId(subject, action);
    if (!permId) {
      toast.error(`Permission mapping for ${action} on ${subject} is not seeded in database.`);
      return;
    }

    const nextStaged = { ...stagedRolePerms };
    const roleSet = new Set(nextStaged[roleId]);

    if (roleSet.has(permId)) {
      roleSet.delete(permId);
    } else {
      roleSet.add(permId);
    }

    nextStaged[roleId] = roleSet;
    setStagedRolePerms(nextStaged);
  };

  // Detect if there are changes between initial and staged mappings
  const hasUnstagedChanges = (): boolean => {
    let diffDetected = false;
    Object.keys(initialRolePerms).forEach(roleId => {
      const initSet = initialRolePerms[roleId];
      const stageSet = stagedRolePerms[roleId];
      
      if (!initSet || !stageSet) return;
      
      if (initSet.size !== stageSet.size) {
        diffDetected = true;
      } else {
        initSet.forEach(item => {
          if (!stageSet.has(item)) diffDetected = true;
        });
      }
    });
    return diffDetected;
  };

  const handleCancelChanges = () => {
    // Reset staged values back to initial database records
    const clone: Record<string, Set<string>> = {};
    Object.keys(initialRolePerms).forEach(key => {
      clone[key] = new Set(initialRolePerms[key]);
    });
    setStagedRolePerms(clone);
    toast.info('Matrix edits discarded.');
  };

  const handleSaveMatrix = async () => {
    setSaving(true);
    try {
      // Compile bulk changes per role
      for (const roleId of Object.keys(initialRolePerms)) {
        const initSet = initialRolePerms[roleId];
        const stageSet = stagedRolePerms[roleId];

        // 1. Identify permissions to add
        const addedIds: string[] = [];
        stageSet.forEach(permId => {
          if (!initSet.has(permId)) {
            addedIds.push(permId);
          }
        });

        // 2. Identify permissions to delete
        const deletedIds: string[] = [];
        initSet.forEach(permId => {
          if (!stageSet.has(permId)) {
            deletedIds.push(permId);
          }
        });

        // 3. Process removals in database
        if (deletedIds.length > 0) {
          const { error: delError } = await supabase
            .from('role_permissions')
            .delete()
            .eq('role_id', roleId)
            .in('permission_id', deletedIds);
          if (delError) throw delError;
        }

        // 4. Process insertions in database
        if (addedIds.length > 0) {
          const insertPayload = addedIds.map(permId => ({
            role_id: roleId,
            permission_id: permId
          }));
          const { error: insError } = await supabase
            .from('role_permissions')
            .insert(insertPayload);
          if (insError) throw insError;
        }

        // 5. Audit Log
        if (addedIds.length > 0 || deletedIds.length > 0) {
          const roleName = roles.find(r => r.id === roleId)?.name || 'unknown';
          const addedNames = addedIds.map(id => {
            const p = permissions.find(x => x.id === id);
            return p ? `${p.action}:${p.subject}` : id;
          });
          const deletedNames = deletedIds.map(id => {
            const p = permissions.find(x => x.id === id);
            return p ? `${p.action}:${p.subject}` : id;
          });

          await auditService.log(
            'update_permissions',
            'role_permissions',
            roleId,
            {
              role: roleName,
              permissions: Array.from(initSet).map(id => {
                const p = permissions.find(x => x.id === id);
                return p ? `${p.action}:${p.subject}` : id;
              })
            },
            {
              role: roleName,
              permissions: Array.from(stageSet).map(id => {
                const p = permissions.find(x => x.id === id);
                return p ? `${p.action}:${p.subject}` : id;
              }),
              added: addedNames,
              deleted: deletedNames
            }
          );
        }
      }

      toast.success('Permissions matrix saved successfully!');
      fetchMatrixData(); // Reload database mappings
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to save permissions: ' + errMsg);
    } finally {
      setSaving(false);
    }
  };

  const isChecked = (roleId: string, subject: string, action: string): boolean => {
    const permId = findPermissionId(subject, action);
    if (!permId) return false;
    return stagedRolePerms[roleId]?.has(permId) ?? false;
  };

  const isModified = (roleId: string, subject: string, action: string): boolean => {
    const permId = findPermissionId(subject, action);
    if (!permId) return false;
    const init = initialRolePerms[roleId]?.has(permId) ?? false;
    const stage = stagedRolePerms[roleId]?.has(permId) ?? false;
    return init !== stage;
  };

  const formatSubject = (subject: string) => {
    return subject.charAt(0).toUpperCase() + subject.slice(1);
  };

  const selectedRoleName = roles.find(r => r.id === selectedRoleId)?.name || '';

  return (
    <div className="space-y-6 animate-fade-in pb-20 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#5c2018]">Permission Matrix</h1>
          <p className="text-gray-500 text-sm mt-1">Configure structural RBAC action accesses for different administrator roles</p>
        </div>
        <Button 
          onClick={fetchMatrixData} 
          variant="outline" 
          className="border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl h-10 px-4 flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Matrix
        </Button>
      </div>

      {/* Floating Save Toolbar */}
      {hasUnstagedChanges() && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1a3b2b] text-white border border-[#d4af37]/30 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 z-50 animate-bounce">
          <div className="flex items-center gap-2 text-xs">
            <Info className="h-5 w-5 text-[#d4af37]" />
            <div>
              <span className="font-bold block">Unstaged Permissions Matrix changes detected!</span>
              <span className="text-[10px] text-[#fdfbf7]/80">Remember to commit changes to database.</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleCancelChanges}
              variant="ghost"
              className="h-9 px-4 rounded-xl text-white hover:bg-white/10 text-xs flex items-center gap-1.5"
            >
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button
              onClick={handleSaveMatrix}
              disabled={saving}
              className="h-9 px-5 rounded-xl bg-[#d4af37] hover:bg-[#bfa032] text-gray-900 font-bold text-xs flex items-center gap-1.5 shadow-md"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Matrix Changes
            </Button>
          </div>
        </div>
      )}

      {/* Role Selection Tabs */}
      <div className="flex flex-wrap gap-2 pb-1 border-b border-gray-200">
        {roles.map(role => {
          const isActive = selectedRoleId === role.id;
          const isSuperAdmin = role.name === 'super_admin';
          return (
            <button
              key={role.id}
              onClick={() => setSelectedRoleId(role.id)}
              className={`flex items-center space-x-2 px-4 py-3 border-b-2 text-xs font-bold uppercase tracking-wider transition-all -mb-[2px] ${
                isActive
                  ? 'border-[#1a3b2b] text-[#1a3b2b]'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Shield className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#1a3b2b]' : 'text-gray-400'}`} />
              <span>{role.name.replace(/_/g, ' ')}</span>
              {isSuperAdmin && <Badge className="bg-amber-100 text-amber-800 ml-1 text-[9px] hover:bg-amber-100">Bypassed</Badge>}
            </button>
          );
        })}
      </div>

      {/* Matrix Display Table */}
      {selectedRoleId && (
        <Card className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-gray-50 px-6 py-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-serif text-[#5c2018] text-lg font-bold">
                Configure Privileges: {selectedRoleName.replace(/_/g, ' ').toUpperCase()}
              </CardTitle>
              <p className="text-xs text-gray-400 mt-0.5">
                {roles.find(r => r.id === selectedRoleId)?.description || 'No description seeded.'}
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-24 text-center text-gray-400">Loading permission details...</div>
            ) : selectedRoleName === 'super_admin' || selectedRoleName === 'admin' ? (
              <div className="py-20 text-center text-gray-400 flex flex-col items-center justify-center max-w-md mx-auto">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-2 stroke-1.5" />
                <p className="font-serif font-bold text-gray-800 text-base">Super Administrator Role</p>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  Super Admins bypass all security checks. All modules (Products, Orders, Settings, Inventory, etc.) and actions (View, Create, Edit, Delete, Manage) are permanently enabled for this role.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto text-xs">
                <Table>
                  <TableHeader className="bg-gray-50/50">
                    <TableRow>
                      <TableHead className="font-semibold text-gray-600 px-6 py-4">Module / Subject</TableHead>
                      {ACTIONS.map(act => (
                        <TableHead key={act} className="font-semibold text-gray-600 py-4 text-center capitalize">{act}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {SUBJECTS.map(subj => (
                      <TableRow key={subj} className="hover:bg-gray-50/40 transition-colors">
                        <TableCell className="px-6 py-3.5 font-bold text-gray-800">
                          {formatSubject(subj)}
                        </TableCell>
                        {ACTIONS.map(action => {
                          const checked = isChecked(selectedRoleId, subj, action);
                          const modified = isModified(selectedRoleId, subj, action);
                          const hasId = findPermissionId(subj, action) !== null;

                          return (
                            <TableCell key={action} className="text-center py-3.5">
                              {hasId ? (
                                <div className="flex items-center justify-center">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={() => handleTogglePermission(selectedRoleId, subj, action)}
                                    className={`rounded border-gray-300 text-[#1a3b2b] focus:ring-[#1a3b2b] transition-all h-4 w-4 ${
                                      modified 
                                        ? 'border-amber-500 ring-2 ring-amber-500/20' 
                                        : checked 
                                          ? 'border-[#1a3b2b] bg-[#1a3b2b]' 
                                          : 'border-gray-300'
                                    }`}
                                  />
                                </div>
                              ) : (
                                <span className="text-[10px] text-gray-300 select-none">—</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

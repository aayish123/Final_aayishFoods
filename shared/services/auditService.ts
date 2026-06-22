import { supabase } from '@/integrations/supabase/client';

export interface AuditLogInput {
  action: string;
  entityType: string;
  entityId: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
}

export const auditService = {
  log: async (
    action: string,
    entityType: string,
    entityId: string,
    oldData?: Record<string, unknown> | null,
    newData?: Record<string, unknown> | null
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('audit_logs')
        .insert({
          user_id: user?.id || null,
          action,
          entity_type: entityType,
          entity_id: entityId,
          old_data: oldData as any,
          new_data: newData as any
        } as any);
      if (error) throw error;
    } catch (err) {
      console.error('Audit log creation failed:', err);
    }
  },

  logMany: async (logs: AuditLogInput[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = logs.map(l => ({
        user_id: user?.id || null,
        action: l.action,
        entity_type: l.entityType,
        entity_id: l.entityId,
        old_data: l.oldData || null,
        new_data: l.newData || null
      }));

      const { error } = await supabase
        .from('audit_logs')
        .insert(payload as any);
      if (error) throw error;
    } catch (err) {
      console.error('Audit log batch creation failed:', err);
    }
  }
};

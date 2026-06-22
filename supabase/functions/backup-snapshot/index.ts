// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get Caller Authorization
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      throw new Error('Missing authorization bearer token');
    }

    let isCronCall = false;
    let callerId: string | null = null;

    // Check if called by the internal system scheduler with the service role key
    if (token === supabaseServiceKey) {
      isCronCall = true;
    } else {
      // Validate user token
      const { data: { user: caller }, error: callerError } = await supabaseClient.auth.getUser(token);
      if (callerError || !caller) {
        throw new Error('Unauthorized caller token');
      }

      callerId = caller.id;

      // Validate caller is a super_admin
      const { data: callerProfile, error: profileCheckError } = await supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', caller.id)
        .single();

      if (profileCheckError || callerProfile?.role !== 'super_admin') {
        throw new Error('Access Denied: Only super_admin accounts can trigger database snapshots.');
      }
    }

    // 2. Parse parameter
    let snapshotType = 'manual';
    if (isCronCall) {
      snapshotType = 'daily'; // Default scheduled type
    }

    try {
      if (req.method === 'POST') {
        const body = await req.json();
        if (body && body.snapshot_type) {
          snapshotType = body.snapshot_type;
        }
      }
    } catch (_) {
      // Ignore body parse exception if empty/GET
    }

    // 3. Call database function
    const { data: snapshotId, error: rpcError } = await supabaseClient.rpc('create_database_snapshot', {
      snap_type: snapshotType
    });

    if (rpcError) throw rpcError;

    // 4. Log in Audit Trail
    const { error: auditError } = await supabaseClient
      .from('audit_logs')
      .insert({
        user_id: callerId,
        action: 'create_database_snapshot',
        entity_type: 'system',
        entity_id: snapshotId,
        old_data: null,
        new_data: {
          snapshot_type: snapshotType,
          triggered_by: isCronCall ? 'system_scheduler' : 'super_admin_ui'
        }
      });

    if (auditError) {
      console.error('Failed to log snapshot creation in audit logs:', auditError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Database snapshot of type '${snapshotType}' completed.`,
        snapshotId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: errorMsg }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

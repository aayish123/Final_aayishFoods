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

    const { data: { user: caller }, error: callerError } = await supabaseClient.auth.getUser(token);
    if (callerError || !caller) {
      throw new Error('Unauthorized caller token');
    }

    // 2. Validate Caller is super_admin
    const { data: callerProfile, error: profileCheckError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();

    if (profileCheckError || callerProfile?.role !== 'super_admin') {
      throw new Error('Access Denied: Only super_admin accounts can register new administrators.');
    }

    // 3. Parse user parameters
    const { email, password, full_name, role_name } = await req.json();
    if (!email || !password || !full_name || !role_name) {
      throw new Error('Missing body params: email, password, full_name, and role_name are required.');
    }

    // 4. Input Validations
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format.');
    }

    // Password: at least 8 chars, 1 uppercase, 1 lowercase, 1 digit
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      throw new Error('Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, and one digit.');
    }

    // Block creating super_admin
    if (role_name === 'super_admin') {
      throw new Error('Forbidden action: Super Admin accounts must be created directly in database console.');
    }

    // 5. Rate Limiter (Max 5 invitations per 15 minutes per caller)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count: inviteCount, error: countError } = await supabaseClient
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', caller.id)
      .eq('action', 'invite_admin_user')
      .gte('created_at', fifteenMinutesAgo);

    if (countError) throw countError;
    if (inviteCount !== null && inviteCount >= 5) {
      throw new Error('Rate limit exceeded: You can only register up to 5 staff accounts every 15 minutes.');
    }

    // 6. Check Email Uniqueness (Verify if user exists in auth)
    const { data: usersData, error: listError } = await supabaseClient.auth.admin.listUsers();
    if (listError) throw listError;
    const emailExists = usersData?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase());
    if (emailExists) {
      throw new Error('Email is already registered.');
    }

    // 7. Create authentic auth user (this triggers profile sync row automatically)
    const { data: newUserData, error: authError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    });

    if (authError) throw authError;

    // 8. Query matching role ID
    const { data: roleRecord, error: roleSearchError } = await supabaseClient
      .from('roles')
      .select('id')
      .eq('name', role_name)
      .single();

    if (roleSearchError || !roleRecord) {
      throw new Error(`Role assignment failed: role '${role_name}' does not exist in DB.`);
    }

    // 9. Update automatically generated profile row
    const { error: profileUpdateError } = await supabaseClient
      .from('profiles')
      .update({
        role: role_name,
        role_id: roleRecord.id,
        full_name: full_name,
        is_active: true
      })
      .eq('id', newUserData.user.id);

    if (profileUpdateError) throw profileUpdateError;

    // 10. Write audit log
    const { error: auditError } = await supabaseClient
      .from('audit_logs')
      .insert({
        user_id: caller.id,
        action: 'invite_admin_user',
        entity_type: 'user',
        entity_id: newUserData.user.id,
        old_data: null,
        new_data: {
          email,
          full_name,
          assigned_role: role_name
        }
      });
    if (auditError) {
      console.error('Failed to log admin invitation audit:', auditError);
    }

    return new Response(JSON.stringify({ success: true, userId: newUserData.user.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: errorMsg }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

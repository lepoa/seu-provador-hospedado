import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Corpo da requisição inválido' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const token = typeof body.token === "string" ? body.token.trim() : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    if (!token || !newPassword) {
      return new Response(
        JSON.stringify({ error: 'Token e nova senha são obrigatórios' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    // Validate token format (64-char hex string)
    if (!/^[0-9a-f]{64}$/i.test(token)) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    if (newPassword.length < 6 || newPassword.length > 128) {
      return new Response(
        JSON.stringify({ error: 'A senha deve ter entre 6 e 128 caracteres' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    console.log('Password reset attempt with token')

    // Create Supabase admin client to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Find the token in database
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle()

    if (tokenError) {
      console.error('Error finding token:', tokenError)
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar token' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    if (!tokenData) {
      console.log('Token not found')
      return new Response(
        JSON.stringify({ error: 'Link inválido ou expirado. Solicite um novo link de recuperação.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    // Check if token is expired
    const expiresAt = new Date(tokenData.expires_at)
    if (expiresAt < new Date()) {
      console.log('Token expired')
      // Delete expired token
      await supabaseAdmin
        .from('password_reset_tokens')
        .delete()
        .eq('id', tokenData.id)

      return new Response(
        JSON.stringify({ error: 'Este link expirou. Por favor, solicite um novo link de recuperação.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    // Check if token was already used
    if (tokenData.used_at) {
      console.log('Token already used')
      return new Response(
        JSON.stringify({ error: 'Este link já foi utilizado. Solicite um novo link se necessário.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    console.log('Token valid, updating password for user:', tokenData.user_id)

    // Update user password using admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      tokenData.user_id,
      { password: newPassword }
    )

    if (updateError) {
      console.error('Error updating password:', updateError)
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar senha. Tente novamente.' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    // Mark token as used
    await supabaseAdmin
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenData.id)

    console.log('Password updated successfully')

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )

  } catch (error: any) {
    console.error('Error in password reset:', error)
    
    return new Response(
      JSON.stringify({ error: 'Erro interno. Tente novamente.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
})

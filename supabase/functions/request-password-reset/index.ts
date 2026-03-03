import React from 'npm:react@18.3.1'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { Resend } from 'npm:resend@4.0.0'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { PasswordResetEmail } from './_templates/password-reset.tsx'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
const DEFAULT_SITE_URL = 'https://lepoa.online'
const DEFAULT_ALLOWED_REDIRECT_ORIGINS = ['https://lepoa.online', 'https://www.lepoa.online']
const DEFAULT_MAIL_FROM = 'Provador VIP Le.Poá <noreply@lepoa.online>'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Generate a secure random token
function generateToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

function normalizeOrigin(input: string | null | undefined): string | null {
  if (!input) return null
  try {
    const parsed = new URL(input)
    return `${parsed.protocol}//${parsed.host}`.toLowerCase()
  } catch {
    return null
  }
}

function getAllowedRedirectOrigins(): Set<string> {
  const envValue = Deno.env.get('ALLOWED_REDIRECT_ORIGINS') ?? ''
  const envOrigins = envValue
    .split(',')
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter((origin): origin is string => Boolean(origin))

  const defaults = DEFAULT_ALLOWED_REDIRECT_ORIGINS
    .map((origin) => normalizeOrigin(origin))
    .filter((origin): origin is string => Boolean(origin))

  return new Set([...(envOrigins.length ? envOrigins : defaults)])
}

function isAllowedRedirectUrl(url: string, allowedOrigins: Set<string>): boolean {
  const origin = normalizeOrigin(url)
  if (!origin) return false
  return allowedOrigins.has(origin)
}

function resolveSiteBaseUrl(redirectUrl?: string): string {
  if (redirectUrl) {
    const parsed = normalizeOrigin(redirectUrl)
    if (parsed) return parsed
  }

  const envSiteUrl = normalizeOrigin(Deno.env.get('SITE_URL'))
  return envSiteUrl || DEFAULT_SITE_URL
}

function resolveMailFrom(): string {
  return Deno.env.get('MAIL_FROM') || DEFAULT_MAIL_FROM
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

    const email = typeof body.email === "string" ? body.email.trim() : "";
    const redirectUrl = typeof body.redirectUrl === "string" ? body.redirectUrl : undefined;

    if (!email || email.length > 254) {
      return new Response(
        JSON.stringify({ error: 'Email é obrigatório' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Formato de email inválido' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const allowedRedirectOrigins = getAllowedRedirectOrigins()

    // Validate redirectUrl if provided.
    if (redirectUrl && !isAllowedRedirectUrl(redirectUrl, allowedRedirectOrigins)) {
      return new Response(
        JSON.stringify({ error: 'URL de redirecionamento inválida' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    console.log('Password reset requested for:', email)

    // Create Supabase admin client to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Check if user exists in auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers()

    if (authError) {
      console.error('Error listing users:', authError)
      // Return success anyway (security: don't reveal if email exists)
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const user = authData.users.find(u => u.email?.toLowerCase() === email.toLowerCase())

    if (!user) {
      console.log('User not found, returning success anyway (security)')
      // Return success anyway (security: don't reveal if email exists)
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    // Get user's name from profile
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('name, full_name')
      .eq('user_id', user.id)
      .maybeSingle()

    const userName = profileData?.name || profileData?.full_name || 'cliente'

    // Generate unique token
    const token = generateToken()
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes

    // Delete any existing tokens for this user
    await supabaseAdmin
      .from('password_reset_tokens')
      .delete()
      .eq('user_id', user.id)

    // Save token to database
    const { error: insertError } = await supabaseAdmin
      .from('password_reset_tokens')
      .insert({
        user_id: user.id,
        email: email.toLowerCase(),
        token,
        expires_at: expiresAt.toISOString(),
      })

    if (insertError) {
      console.error('Error saving token:', insertError)
      throw new Error('Erro ao gerar token de recuperação')
    }

    console.log('Token saved, sending email...')

    // Build reset URL
    const baseUrl = resolveSiteBaseUrl(redirectUrl)
    const resetUrl = `${baseUrl}/resetar-senha?token=${token}`

    // Render email template
    const html = await renderAsync(
      React.createElement(PasswordResetEmail, {
        userName,
        resetUrl,
      })
    )

    // Send email via Resend
    const { error: emailError } = await resend.emails.send({
      from: resolveMailFrom(),
      to: [email],
      subject: '🔐 Recuperação de senha — Provador VIP Le.Poá',
      html,
    })

    if (emailError) {
      console.error('Resend error:', emailError)
      // Don't reveal email sending errors to user
    } else {
      console.log('Password reset email sent successfully to:', email)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )

  } catch (error: any) {
    console.error('Error in password reset request:', error)

    // Always return success (security: don't reveal internal errors)
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
})

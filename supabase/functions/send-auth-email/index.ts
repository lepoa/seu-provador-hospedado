import React from 'npm:react@18.3.1'
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { Resend } from 'npm:resend@4.0.0'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { PasswordResetEmail } from './_templates/password-reset.tsx'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string

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

  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)

  console.log('Received auth email webhook')

  try {
    const wh = new Webhook(hookSecret)
    const {
      user,
      email_data: { token, token_hash, redirect_to, email_action_type },
    } = wh.verify(payload, headers) as {
      user: {
        email: string
      }
      email_data: {
        token: string
        token_hash: string
        redirect_to: string
        email_action_type: string
        site_url: string
        token_new: string
        token_hash_new: string
      }
    }

    console.log('Processing email for:', user.email)
    console.log('Email action type:', email_action_type)

    // Handle password recovery emails
    if (email_action_type === 'recovery') {
      const html = await renderAsync(
        React.createElement(PasswordResetEmail, {
          supabase_url: Deno.env.get('SUPABASE_URL') ?? '',
          token_hash,
          redirect_to,
          email_action_type,
        })
      )

      console.log('Sending password reset email via Resend')

      const { error } = await resend.emails.send({
        from: 'Provador VIP Le.Poá <noreply@lightcoral-cod-859891.hostingersite.com>',
        to: [user.email],
        subject: 'Redefinir sua senha – Provador VIP Le.Poá',
        html,
      })

      if (error) {
        console.error('Resend error:', error)
        throw error
      }

      console.log('Password reset email sent successfully')
    } else {
      // For other email types (signup, magic_link, etc.), use default Supabase emails
      console.log('Email type not customized, using default template')

      return new Response(
        JSON.stringify({
          error: {
            http_code: 422,
            message: 'Email type not handled by custom hook',
          },
        }),
        {
          status: 422,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      )
    }

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })

  } catch (error: any) {
    console.error('Error processing auth email:', error)

    return new Response(
      JSON.stringify({
        error: {
          http_code: error.code || 500,
          message: error.message || 'Internal server error',
        },
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    )
  }
})

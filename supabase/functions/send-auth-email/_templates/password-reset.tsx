import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
  Font,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface PasswordResetEmailProps {
  supabase_url: string
  token_hash: string
  redirect_to: string
  email_action_type: string
}

export const PasswordResetEmail = ({
  supabase_url,
  token_hash,
  redirect_to,
  email_action_type,
}: PasswordResetEmailProps) => {
  const resetUrl = `${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`

  return (
    <Html>
      <Head>
        <Font
          fontFamily="Cormorant Garamond"
          fallbackFontFamily="Georgia"
          webFont={{
            url: 'https://fonts.gstatic.com/s/cormorantgaramond/v16/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYrEtFmQ.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Preview>Redefinir sua senha – Provador VIP Le.Poá</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with Logo Text */}
          <Section style={header}>
            <Text style={logoText}>
              Provador VIP
            </Text>
            <Text style={logoSubtext}>Le.Poá</Text>
          </Section>

          {/* Main Card */}
          <Section style={card}>
            <Heading style={h1}>Redefinir sua senha</Heading>
            
            <Text style={text}>
              Olá! Você solicitou a redefinição da sua senha. Clique no botão abaixo para criar uma nova senha:
            </Text>

            <Section style={buttonContainer}>
              <Link href={resetUrl} style={button}>
                Criar nova senha
              </Link>
            </Section>

            <Text style={textSmall}>
              Ou copie e cole este link no seu navegador:
            </Text>
            <Text style={linkText}>
              {resetUrl}
            </Text>

            <Hr style={divider} />

            <Text style={securityNote}>
              ⚠️ Este link expira em 60 minutos por motivos de segurança.
            </Text>
            <Text style={securityNote}>
              Se você não solicitou esta alteração, ignore este e-mail. Sua senha permanecerá a mesma.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Precisa de ajuda? Entre em contato conosco:
            </Text>
            <Text style={footerContact}>
              📱 WhatsApp: (62) 99122-3519
            </Text>
            <Text style={footerContact}>
              📸 Instagram: @le.poa
            </Text>
            <Hr style={footerDivider} />
            <Text style={footerCopyright}>
              © 2026 Provador VIP Le.Poá. Todos os direitos reservados.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default PasswordResetEmail

// Styles
const main = {
  backgroundColor: '#faf7f3',
  fontFamily: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
  padding: '40px 20px',
}

const container = {
  margin: '0 auto',
  maxWidth: '560px',
}

const header = {
  textAlign: 'center' as const,
  marginBottom: '24px',
}

const logoText = {
  fontSize: '32px',
  fontWeight: '600',
  color: '#0f2a1f',
  margin: '0',
  lineHeight: '1.2',
}

const logoSubtext = {
  fontSize: '14px',
  color: '#c4a07a',
  margin: '4px 0 0 0',
  letterSpacing: '2px',
  textTransform: 'uppercase' as const,
}

const card = {
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  padding: '40px 32px',
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
}

const h1 = {
  color: '#0f2a1f',
  fontSize: '28px',
  fontWeight: '600',
  textAlign: 'center' as const,
  margin: '0 0 24px 0',
}

const text = {
  color: '#333333',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 24px 0',
  textAlign: 'center' as const,
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
}

const button = {
  backgroundColor: '#0f2a1f',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600',
  padding: '16px 32px',
  textDecoration: 'none',
  textAlign: 'center' as const,
}

const textSmall = {
  color: '#666666',
  fontSize: '14px',
  textAlign: 'center' as const,
  margin: '0 0 8px 0',
}

const linkText = {
  color: '#0f2a1f',
  fontSize: '12px',
  wordBreak: 'break-all' as const,
  textAlign: 'center' as const,
  backgroundColor: '#f5f5f5',
  padding: '12px',
  borderRadius: '8px',
  margin: '0 0 24px 0',
}

const divider = {
  borderColor: '#e5e5e5',
  margin: '24px 0',
}

const securityNote = {
  color: '#888888',
  fontSize: '13px',
  textAlign: 'center' as const,
  margin: '0 0 8px 0',
  lineHeight: '1.5',
}

const footer = {
  textAlign: 'center' as const,
  marginTop: '32px',
}

const footerText = {
  color: '#666666',
  fontSize: '14px',
  margin: '0 0 12px 0',
}

const footerContact = {
  color: '#0f2a1f',
  fontSize: '14px',
  margin: '0 0 6px 0',
  fontWeight: '500',
}

const footerDivider = {
  borderColor: '#e5e5e5',
  margin: '20px 0',
}

const footerCopyright = {
  color: '#999999',
  fontSize: '12px',
  margin: '0',
}

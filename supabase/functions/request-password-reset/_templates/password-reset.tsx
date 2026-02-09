import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface PasswordResetEmailProps {
  userName?: string
  resetUrl: string
}

export const PasswordResetEmail = ({
  userName = 'cliente',
  resetUrl,
}: PasswordResetEmailProps) => (
  <Html>
    <Head>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&display=swap');
        `}
      </style>
    </Head>
    <Preview>Recuperação de senha — Provador VIP Le.Poá</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header with Logo */}
        <Section style={header}>
          <Img
            src="https://fozxeyiqulvpbbawjznw.supabase.co/storage/v1/object/public/email-assets/logo.png?v=1"
            width="120"
            height="auto"
            alt="Le.Poá"
            style={logo}
          />
        </Section>

        {/* Main Content Card */}
        <Section style={card}>
          <Heading style={h1}>Recuperação de senha</Heading>
          
          <Text style={greeting}>
            Olá, {userName} 💛
          </Text>
          
          <Text style={text}>
            Recebemos uma solicitação para redefinir a sua senha no Provador VIP da Le.Poá.
          </Text>
          
          <Text style={text}>
            Para criar uma nova senha e voltar a acessar suas sugestões personalizadas, 
            é só clicar no botão abaixo:
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={resetUrl}>
              Criar nova senha
            </Button>
          </Section>

          <Text style={timerNote}>
            ⏱️ Este link é válido por <strong>30 minutos</strong>.
          </Text>

          <Hr style={divider} />

          <Text style={securityNote}>
            Se você não solicitou essa alteração, pode ficar tranquila — é só ignorar este e-mail. 
            Sua conta continua segura.
          </Text>
        </Section>

        {/* Signature */}
        <Section style={signature}>
          <Text style={signatureText}>
            Com carinho,<br />
            <strong>Equipe Le.Poá</strong>
          </Text>
          <Text style={tagline}>
            Seu estilo, no seu tempo ✨
          </Text>
        </Section>

        {/* Footer */}
        <Section style={footer}>
          <Hr style={footerDivider} />
          
          <Text style={footerBrand}>Le.Poá</Text>
          
          <Text style={footerAddress}>
            Rua Rodrigues Tomaz, 65 – Jundiaí<br />
            Anápolis / GO
          </Text>
          
          <Text style={footerSocial}>
            <Link href="https://instagram.com/le.poa" style={footerLink}>
              Instagram: @le.poa
            </Link>
            {' · '}
            <Link href="https://wa.me/5562991223519" style={footerLink}>
              WhatsApp: (62) 99122-3519
            </Link>
          </Text>
          
          <Text style={footerCopy}>
            © {new Date().getFullYear()} Le.Poá. Todos os direitos reservados.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default PasswordResetEmail

// Styles
const main = {
  backgroundColor: '#faf7f3',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
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

const logo = {
  margin: '0 auto',
}

const card = {
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  padding: '40px 32px',
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
}

const h1 = {
  color: '#0f2a1f',
  fontFamily: '"Cormorant Garamond", Georgia, serif',
  fontSize: '28px',
  fontWeight: '600' as const,
  lineHeight: '1.3',
  margin: '0 0 24px 0',
  textAlign: 'center' as const,
}

const greeting = {
  color: '#1a1a1a',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 16px 0',
}

const text = {
  color: '#4a4a4a',
  fontSize: '15px',
  lineHeight: '1.7',
  margin: '0 0 16px 0',
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
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: '15px',
  fontWeight: '600' as const,
  lineHeight: '1',
  padding: '16px 32px',
  textDecoration: 'none',
  textAlign: 'center' as const,
}

const timerNote = {
  color: '#6b7280',
  fontSize: '13px',
  lineHeight: '1.5',
  margin: '0 0 24px 0',
  textAlign: 'center' as const,
}

const divider = {
  borderColor: '#e5e7eb',
  borderTop: '1px solid #e5e7eb',
  margin: '24px 0',
}

const securityNote = {
  color: '#9ca3af',
  fontSize: '13px',
  lineHeight: '1.6',
  margin: '0',
  fontStyle: 'italic' as const,
}

const signature = {
  textAlign: 'center' as const,
  padding: '24px 0',
}

const signatureText = {
  color: '#4a4a4a',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '0 0 4px 0',
}

const tagline = {
  color: '#9ca3af',
  fontSize: '13px',
  lineHeight: '1.5',
  margin: '0',
}

const footer = {
  textAlign: 'center' as const,
  padding: '0 20px',
}

const footerDivider = {
  borderColor: '#e5e7eb',
  borderTop: '1px solid #e5e7eb',
  margin: '0 0 20px 0',
}

const footerBrand = {
  color: '#0f2a1f',
  fontFamily: '"Cormorant Garamond", Georgia, serif',
  fontSize: '18px',
  fontWeight: '600' as const,
  margin: '0 0 8px 0',
}

const footerAddress = {
  color: '#9ca3af',
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '0 0 8px 0',
}

const footerSocial = {
  color: '#9ca3af',
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '0 0 16px 0',
}

const footerLink = {
  color: '#6b7280',
  textDecoration: 'none',
}

const footerCopy = {
  color: '#d1d5db',
  fontSize: '11px',
  margin: '0',
}

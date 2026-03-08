export function welcomeEmailTemplate(name: string) {
  return `
    <h2>Bem-vinda a Le.Poa ✨</h2>
    <p>Ola ${name || "Cliente"},</p>
    <p>Sua conta foi criada com sucesso.</p>

    <p>Agora voce pode:</p>

    <ul>
      <li>Acompanhar seus pedidos</li>
      <li>Participar do Le.Poa Club</li>
      <li>Receber sugestoes de looks</li>
    </ul>

    <p>Equipe Le.Poa</p>
  `;
}

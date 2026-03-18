import fs from 'fs';

const file = 'c:\\seuprovador\\src\\components\\home\\FloatingAtelierChat.tsx';
let txt = fs.readFileSync(file, 'utf8');

txt = txt.replace(
  /const \[messages, setMessages\] = useState<ChatMessage\[\]>\(\(\) => loadMessages\(\)\);/,
  'const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages());\n  const [isExpired, setIsExpired] = useState(false);'
);

txt = txt.replace(
  /const maybeAutoOpen = \(reason: AutoOpenReason\) => \{/,
  `useEffect(() => {
    if (!isOpen || isGenerating) return;
    
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.type === 'bot' && lastMessage.id !== WELCOME_MESSAGE.id && !isExpired) {
      const timer = setTimeout(() => {
        setIsExpired(true);
        appendBotMessage('Por falta de interação neste período, seu atendimento está sendo encerrado. Se quiser voltar a conversar com a consultora, seu histórico será reiniciado como um novo atendimento.');
      }, 60000);
      return () => clearTimeout(timer);
    }
  }, [messages, isOpen, isGenerating, isExpired]);

  const maybeAutoOpen = (reason: AutoOpenReason) => {`
);

txt = txt.replace(
  /const handleSendMessage = async \(text: string\) => \{\s+const cleanedText = text\.trim\(\);\s+if \(!cleanedText \|\| isGenerating\) return;\s+const normalizedInput = normalizeInputText\(cleanedText\);/,
  `const handleSendMessage = async (text: string) => {
    const cleanedText = text.trim();
    if (!cleanedText || isGenerating) return;

    let baseMessages = messages;
    if (isExpired) {
      setIsExpired(false);
      window.localStorage.removeItem(STORAGE_SESSION_ID_KEY);
      baseMessages = [WELCOME_MESSAGE];
    }

    const normalizedInput = normalizeInputText(cleanedText);`
);

txt = txt.replace(
  /setMessages\(\(prev\) => \[\.\.\.prev, userMessage\]\);/,
  'setMessages([...baseMessages, userMessage]);'
);

fs.writeFileSync(file, txt);
console.log('Patched');

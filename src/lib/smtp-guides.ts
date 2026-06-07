export type SmtpPreset = {
  id: string;
  name: string;
  host: string;
  port: string;
  /** "true" = SSL na porta 465; "false" = STARTTLS (587) */
  secure: string;
  steps: string[];
  tips: string[];
  docsUrl?: string;
};

/** Tutoriais passo a passo para configurar SMTP nos provedores mais comuns no Brasil. */
export const SMTP_PRESETS: SmtpPreset[] = [
  {
    id: "gmail",
    name: "Gmail",
    host: "smtp.gmail.com",
    port: "587",
    secure: "false",
    docsUrl: "https://support.google.com/accounts/answer/185833",
    steps: [
      "Abra sua Conta Google em myaccount.google.com",
      "Vá em Segurança e ative a Verificação em duas etapas (é obrigatória)",
      "Ainda em Segurança, procure por Senhas de app e clique em Criar",
      "Escolha o app E-mail e o dispositivo Outro — digite Automatite",
      "O Google vai gerar uma senha de 16 letras — copie e cole no campo Senha abaixo",
      "No campo E-mail, use seu endereço @gmail.com completo",
    ],
    tips: [
      "Não use sua senha normal do Gmail — só funciona com senha de app",
      "A senha de app aparece uma única vez; se perder, crie outra",
    ],
  },
  {
    id: "outlook",
    name: "Outlook / Hotmail",
    host: "smtp-mail.outlook.com",
    port: "587",
    secure: "false",
    docsUrl: "https://support.microsoft.com/pt-br/account-billing/using-app-passwords-with-apps-that-don-t-support-two-step-verification-5896ed9b-4263-e681-128a-a6f2979a7944",
    steps: [
      "Acesse account.microsoft.com e faça login",
      "Vá em Segurança → Verificação em duas etapas e ative se ainda não estiver",
      "Em Senhas de aplicativo, crie uma nova senha para Automatite",
      "Copie a senha gerada e cole no campo Senha abaixo",
      "No campo E-mail, use seu @outlook.com, @hotmail.com ou @live.com",
    ],
    tips: ["Contas corporativas Microsoft 365 podem precisar de liberação do administrador de TI"],
  },
  {
    id: "yahoo",
    name: "Yahoo Mail",
    host: "smtp.mail.yahoo.com",
    port: "587",
    secure: "false",
    docsUrl: "https://help.yahoo.com/kb/generate-manage-third-party-passwords-sln15241.html",
    steps: [
      "Acesse login.yahoo.com → ícone do perfil → Account Info",
      "Vá em Account Security e ative a verificação em duas etapas",
      "Clique em Generate app password e crie uma para Automatite",
      "Copie a senha e cole no campo Senha abaixo",
      "Use seu e-mail @yahoo.com ou @yahoo.com.br no campo E-mail",
    ],
    tips: ["Yahoo exige senha de app — a senha normal da conta não funciona"],
  },
  {
    id: "hostinger",
    name: "Hostinger / e-mail do site",
    host: "smtp.hostinger.com",
    port: "465",
    secure: "true",
    docsUrl: "https://support.hostinger.com/pt/articles/4305847-como-obter-os-dados-de-configuracao-de-e-mail-da-hostinger",
    steps: [
      "Entre no painel da Hostinger → E-mails",
      "Crie ou selecione sua caixa de e-mail (ex: contato@suaempresa.com)",
      "Anote o servidor SMTP: smtp.hostinger.com, porta 465 com SSL",
      "Use o e-mail completo no campo E-mail e a senha da caixa de correio no campo Senha",
      "No Remetente, coloque o mesmo e-mail (ex: contato@suaempresa.com)",
    ],
    tips: [
      "Funciona também para e-mails profissionais de outros hosts com cPanel — use o SMTP que seu provedor informou",
      "Porta 465 = SSL ligado; porta 587 = SSL desligado (STARTTLS)",
    ],
  },
  {
    id: "custom",
    name: "Outro provedor",
    host: "",
    port: "587",
    secure: "false",
    steps: [
      "Pesquise no Google: SMTP + nome do seu provedor de e-mail",
      "Anote: servidor (host), porta, se usa SSL e seu e-mail com senha",
      "Preencha os campos abaixo com essas informações",
      "Se não souber, pergunte ao suporte do seu provedor de hospedagem ou domínio",
    ],
    tips: [
      "Provedores comuns: Locaweb (email-ssl.com.br), UOL Host, GoDaddy, Zoho Mail",
      "E-mail corporativo geralmente usa mail.suaempresa.com ou smtp.suaempresa.com",
    ],
  },
];

export function getSmtpPreset(id: string): SmtpPreset | undefined {
  return SMTP_PRESETS.find((p) => p.id === id);
}

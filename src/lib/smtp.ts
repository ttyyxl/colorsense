// Deprecated: result export is local PNG download only; no SMTP email is sent.
import * as tls from "node:tls";

interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export function getSmtpSettings(): SmtpSettings | null {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    return null;
  }

  const port = Number.parseInt(SMTP_PORT, 10);
  if (!Number.isFinite(port)) {
    return null;
  }

  return { host: SMTP_HOST, port, user: SMTP_USER, pass: SMTP_PASS, from: SMTP_FROM };
}

function readReply(socket: tls.TLSSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    const onData = (data: Buffer) => {
      const reply = data.toString("utf8");
      if (/(?:^|\r?\n)[45]\d\d[ -]/.test(reply)) {
        cleanup();
        reject(new Error(reply.trim()));
        return;
      }
      if (/(?:^|\r?\n)\d{3} /.test(reply)) {
        cleanup();
        resolve(reply);
      }
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
    };

    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function command(socket: tls.TLSSocket, value: string) {
  socket.write(`${value}\r\n`);
  await readReply(socket);
}

export async function sendSmtpMail(settings: SmtpSettings, message: MailMessage): Promise<void> {
  const socket = tls.connect({
    host: settings.host,
    port: settings.port,
    servername: settings.host,
  });
  const greeting = readReply(socket);

  await new Promise<void>((resolve, reject) => {
    socket.once("secureConnect", resolve);
    socket.once("error", reject);
  });

  try {
    await greeting;
    await command(socket, `EHLO ${settings.host}`);
    await command(socket, "AUTH LOGIN");
    await command(socket, Buffer.from(settings.user).toString("base64"));
    await command(socket, Buffer.from(settings.pass).toString("base64"));
    await command(socket, `MAIL FROM:<${settings.from}>`);
    await command(socket, `RCPT TO:<${message.to}>`);
    await command(socket, "DATA");

    const body = message.text.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
    socket.write(
      [
        `From: ColorSense <${settings.from}>`,
        `To: ${message.to}`,
        `Subject: =?UTF-8?B?${Buffer.from(message.subject).toString("base64")}?=`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "",
        body,
        ".",
        "",
      ].join("\r\n"),
    );
    await readReply(socket);
    await command(socket, "QUIT");
  } finally {
    socket.end();
  }
}

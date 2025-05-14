import { MailService } from '@sendgrid/mail';
import { User } from '@shared/schema';

// Modalità di sviluppo (non invia email effettivamente ma le mostra in console)
// Imposta su false per inviare email reali con SendGrid (richiede SENDGRID_API_KEY)
const DEV_MODE = true;

if (!process.env.SENDGRID_API_KEY) {
  console.warn("ATTENZIONE: SENDGRID_API_KEY non è configurata nell'ambiente. Le email non verranno inviate.");
}

const mailService = new MailService();
if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

// Indirizzo email del mittente (deve essere verificato su SendGrid)
const SENDER_EMAIL = process.env.EMAIL_USER || 'gestione.davittorino@gmail.com';

/**
 * Interfaccia per i parametri di invio email
 */
export interface EmailParams {
  to: string;
  subject: string;
  text?: string;
  html: string;
}

/**
 * Invia un'email utilizzando SendGrid
 */
export async function sendEmail(params: EmailParams): Promise<boolean> {
  console.log("ℹ️ Tentativo di invio email:", params.subject);
  
  if (!process.env.SENDGRID_API_KEY) {
    console.warn("❌ Email non inviata (SENDGRID_API_KEY mancante):", params.subject);
    return false;
  }

  // In modalità sviluppo, simula l'invio dell'email e mostra i dettagli in console
  if (DEV_MODE) {
    console.log("\n");
    console.log("================================");
    console.log("📧 SIMULAZIONE INVIO EMAIL 📧");
    console.log("================================");
    console.log("📧 A:", params.to);
    console.log("📧 Da:", SENDER_EMAIL);
    console.log("📧 Oggetto:", params.subject);
    console.log("--------------------------------");
    console.log("📧 Contenuto HTML:");
    console.log(params.html);
    console.log("================================");
    console.log("✅ Email simulata con successo (non inviata realmente in modalità DEV)");
    console.log("\n");
    
    // Ritorna true come se l'invio fosse riuscito
    return true;
  }

  // In modalità produzione, invia effettivamente l'email
  try {
    console.log("📧 Invio email reale...");
    console.log("📧 Destinatario:", params.to);
    console.log("📧 Mittente:", SENDER_EMAIL);
    console.log("📧 Oggetto:", params.subject);
    
    await mailService.send({
      to: params.to,
      from: SENDER_EMAIL,
      subject: params.subject,
      text: params.text || '',
      html: params.html,
    });
    
    console.log(`✅ Email inviata con successo a ${params.to}: ${params.subject}`);
    return true;
  } catch (error) {
    console.error('❌ Errore nell\'invio email:', error);
    if (error instanceof Error) {
      console.error('Dettagli errore:', error.message);
      console.error('Stack:', error.stack);
    }
    return false;
  }
}

/**
 * Invia una notifica di pubblicazione di un nuovo turno
 */
export async function sendScheduleNotification(user: User, scheduleStartDate: string, scheduleEndDate: string): Promise<boolean> {
  const startDate = new Date(scheduleStartDate).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const endDate = new Date(scheduleEndDate).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  
  return sendEmail({
    to: user.email || user.username,
    subject: `Nuovo turno pubblicato (${startDate} - ${endDate})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #8B0000;">Da Vittorino</h2>
        </div>
        <p>Gentile ${user.name || user.username},</p>
        <p>Ti informiamo che è stato pubblicato un nuovo turno di lavoro per il periodo <strong>${startDate} - ${endDate}</strong>.</p>
        <p>Puoi visualizzare i dettagli del tuo turno accedendo alla piattaforma.</p>
        <div style="text-align: center; margin-top: 30px;">
          <a href="${process.env.APP_URL || 'https://staffsync.replit.app'}/my-schedule" style="background-color: #8B0000; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Visualizza Turno</a>
        </div>
        <p style="margin-top: 30px; font-size: 12px; color: #666; text-align: center;">
          Questa è un'email automatica, ti preghiamo di non rispondere.
        </p>
      </div>
    `,
  });
}

/**
 * Invia una notifica di aggiornamento di un turno
 */
export async function sendScheduleUpdateNotification(user: User, scheduleStartDate: string, scheduleEndDate: string): Promise<boolean> {
  const startDate = new Date(scheduleStartDate).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const endDate = new Date(scheduleEndDate).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  
  return sendEmail({
    to: user.email || user.username,
    subject: `Turno aggiornato (${startDate} - ${endDate})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #8B0000;">Da Vittorino</h2>
        </div>
        <p>Gentile ${user.name || user.username},</p>
        <p>Ti informiamo che è stato <strong>aggiornato</strong> il tuo turno di lavoro per il periodo <strong>${startDate} - ${endDate}</strong>.</p>
        <p>Si prega di verificare le modifiche accedendo alla piattaforma.</p>
        <div style="text-align: center; margin-top: 30px;">
          <a href="${process.env.APP_URL || 'https://staffsync.replit.app'}/my-schedule" style="background-color: #8B0000; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Visualizza Turno</a>
        </div>
        <p style="margin-top: 30px; font-size: 12px; color: #666; text-align: center;">
          Questa è un'email automatica, ti preghiamo di non rispondere.
        </p>
      </div>
    `,
  });
}

/**
 * Invia una notifica per un nuovo documento caricato
 */
export async function sendDocumentNotification(user: User, documentType: string, period: string): Promise<boolean> {
  const documentTypes: Record<string, string> = {
    'payslip': 'Busta Paga',
    'cud': 'CUD',
    'tax': 'Documento Fiscale',
    'contract': 'Contratto',
    'other': 'Documento'
  };
  
  const documentName = documentTypes[documentType] || 'Documento';
  
  return sendEmail({
    to: user.email || user.username,
    subject: `Nuovo ${documentName} disponibile`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #8B0000;">Da Vittorino</h2>
        </div>
        <p>Gentile ${user.name || user.username},</p>
        <p>Ti informiamo che è stato caricato un nuovo documento: <strong>${documentName}</strong> per il periodo <strong>${period}</strong>.</p>
        <p>Puoi visualizzare e scaricare il documento accedendo alla piattaforma.</p>
        <div style="text-align: center; margin-top: 30px;">
          <a href="${process.env.APP_URL || 'https://staffsync.replit.app'}/my-documents" style="background-color: #8B0000; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Visualizza Documento</a>
        </div>
        <p style="margin-top: 30px; font-size: 12px; color: #666; text-align: center;">
          Questa è un'email automatica, ti preghiamo di non rispondere.
        </p>
      </div>
    `,
  });
}

/**
 * Invia una notifica per richiesta ferie/permesso approvata
 */
export async function sendTimeOffApprovalNotification(user: User, type: string, startDate: string, endDate: string): Promise<boolean> {
  const typeLabels: Record<string, string> = {
    'vacation': 'Ferie',
    'permission': 'Permesso',
    'sick': 'Malattia'
  };
  
  const typeLabel = typeLabels[type] || 'Assenza';
  const formattedStartDate = new Date(startDate).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formattedEndDate = new Date(endDate).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  
  return sendEmail({
    to: user.email || user.username,
    subject: `${typeLabel} approvata`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #8B0000;">Da Vittorino</h2>
        </div>
        <p>Gentile ${user.name || user.username},</p>
        <p>Ti informiamo che la tua richiesta di <strong>${typeLabel.toLowerCase()}</strong> per il periodo <strong>${formattedStartDate} - ${formattedEndDate}</strong> è stata <span style="color: green;"><strong>approvata</strong></span>.</p>
        <p>Puoi visualizzare lo stato di tutte le tue richieste accedendo alla piattaforma.</p>
        <div style="text-align: center; margin-top: 30px;">
          <a href="${process.env.APP_URL || 'https://staffsync.replit.app'}/time-off" style="background-color: #8B0000; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Le Mie Richieste</a>
        </div>
        <p style="margin-top: 30px; font-size: 12px; color: #666; text-align: center;">
          Questa è un'email automatica, ti preghiamo di non rispondere.
        </p>
      </div>
    `,
  });
}

/**
 * Invia una notifica per richiesta ferie/permesso rifiutata
 */
export async function sendTimeOffRejectionNotification(user: User, type: string, startDate: string, endDate: string): Promise<boolean> {
  const typeLabels: Record<string, string> = {
    'vacation': 'Ferie',
    'permission': 'Permesso',
    'sick': 'Malattia'
  };
  
  const typeLabel = typeLabels[type] || 'Assenza';
  const formattedStartDate = new Date(startDate).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formattedEndDate = new Date(endDate).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  
  return sendEmail({
    to: user.email || user.username,
    subject: `${typeLabel} rifiutata`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #8B0000;">Da Vittorino</h2>
        </div>
        <p>Gentile ${user.name || user.username},</p>
        <p>Ti informiamo che la tua richiesta di <strong>${typeLabel.toLowerCase()}</strong> per il periodo <strong>${formattedStartDate} - ${formattedEndDate}</strong> è stata <span style="color: red;"><strong>rifiutata</strong></span>.</p>
        <p>Per maggiori informazioni, contatta il tuo responsabile.</p>
        <p>Puoi visualizzare lo stato di tutte le tue richieste accedendo alla piattaforma.</p>
        <div style="text-align: center; margin-top: 30px;">
          <a href="${process.env.APP_URL || 'https://staffsync.replit.app'}/time-off" style="background-color: #8B0000; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Le Mie Richieste</a>
        </div>
        <p style="margin-top: 30px; font-size: 12px; color: #666; text-align: center;">
          Questa è un'email automatica, ti preghiamo di non rispondere.
        </p>
      </div>
    `,
  });
}
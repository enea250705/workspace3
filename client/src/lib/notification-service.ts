/**
 * Servizio di notifica per gestire comunicazioni email e notifiche in-app
 */

/**
 * Genera una email fittizia che può essere copiata o aperta nel client email predefinito
 * @param to Email del destinatario
 * @param subject Oggetto dell'email
 * @param body Corpo dell'email (testo o HTML)
 * @returns URL per mailto o oggetto con i dati dell'email
 */
export function generateEmail(to: string, subject: string, body: string): { 
  mailtoUrl: string;
  emailContent: {
    to: string;
    subject: string;
    body: string;
  };
} {
  // Pulisce il body per il mailto URL
  const cleanBody = body.replace(/<[^>]*>?/gm, '').replace(/\n/g, '%0A');
  
  // Crea un mailto URL che apre il client email predefinito
  const mailtoUrl = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(cleanBody)}`;
  
  return {
    mailtoUrl,
    emailContent: {
      to,
      subject,
      body
    }
  };
}

/**
 * Genera un'email per notificare un dipendente riguardo alla pianificazione
 * @param email Email del dipendente
 * @param name Nome del dipendente
 * @param scheduleDate Data della pianificazione
 * @param shifts Array con i turni
 * @returns Dati email
 */
export function generateScheduleEmail(
  email: string, 
  name: string, 
  scheduleStartDate: string, 
  scheduleEndDate: string, 
  shifts: any[]
): { 
  mailtoUrl: string;
  emailContent: {
    to: string;
    subject: string;
    body: string;
  };
} {
  const subject = `Pianificazione turni: ${scheduleStartDate} - ${scheduleEndDate}`;
  
  // Crea la tabella con i turni
  let shiftsTable = '';
  if (shifts && shifts.length > 0) {
    shiftsTable = '<table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">';
    shiftsTable += '<tr><th>Giorno</th><th>Orario</th><th>Tipo</th><th>Note</th></tr>';
    
    shifts.forEach(shift => {
      const shiftType = shift.type === 'work' ? 'Lavoro' : shift.type === 'vacation' ? 'Ferie' : 'Permesso';
      shiftsTable += `<tr>
        <td>${shift.day}</td>
        <td>${shift.startTime} - ${shift.endTime}</td>
        <td>${shiftType}</td>
        <td>${shift.notes || ''}</td>
      </tr>`;
    });
    
    shiftsTable += '</table>';
  } else {
    shiftsTable = '<p>Nessun turno pianificato per questo periodo.</p>';
  }
  
  const body = `
    <p>Gentile ${name},</p>
    <p>È stata pubblicata/aggiornata la pianificazione dei turni per il periodo ${scheduleStartDate} - ${scheduleEndDate}.</p>
    
    <h3>I tuoi turni:</h3>
    ${shiftsTable}
    
    <p>Per visualizzare tutti i dettagli, accedi alla piattaforma dalla sezione "I miei turni".</p>
    
    <p>Cordiali saluti,<br/>
    Gestione del Personale</p>
  `;
  
  return generateEmail(email, subject, body);
}

/**
 * Genera un'email per notificare un dipendente riguardo alla risposta su ferie/permessi
 * @param email Email del dipendente
 * @param name Nome del dipendente
 * @param requestType Tipo di richiesta
 * @param startDate Data inizio
 * @param endDate Data fine
 * @param isApproved Approvato o respinto
 * @returns Dati email
 */
export function generateTimeOffResponseEmail(
  email: string,
  name: string,
  requestType: string,
  startDate: string,
  endDate: string,
  isApproved: boolean
): {
  mailtoUrl: string;
  emailContent: {
    to: string;
    subject: string;
    body: string;
  };
} {
  const requestTypeText = requestType === 'vacation' ? 'ferie' : 'permesso';
  const approvalStatus = isApproved ? 'approvata' : 'respinta';
  
  const subject = `Richiesta di ${requestTypeText} ${approvalStatus}`;
  
  const body = `
    <p>Gentile ${name},</p>
    
    <p>La tua richiesta di ${requestTypeText} per il periodo dal ${startDate} al ${endDate} è stata <strong>${approvalStatus}</strong>.</p>
    
    ${!isApproved ? '<p>Per ulteriori informazioni, contatta il tuo responsabile.</p>' : ''}
    
    <p>Puoi visualizzare lo stato di tutte le tue richieste nella sezione "Richieste" della piattaforma.</p>
    
    <p>Cordiali saluti,<br/>
    Gestione del Personale</p>
  `;
  
  return generateEmail(email, subject, body);
}

/**
 * Genera una email di massa per tutti i dipendenti
 * @param emails Array di email e nomi dei dipendenti
 * @param subject Oggetto
 * @param body Corpo
 * @returns Array di dati email
 */
export function generateBulkEmail(
  employees: Array<{email: string, name: string}>,
  subject: string,
  body: string
): Array<{
  mailtoUrl: string;
  emailContent: {
    to: string;
    subject: string;
    body: string;
  };
}> {
  return employees.map(employee => {
    // Personalizza il body per il singolo dipendente
    const personalizedBody = body.replace(/\{name\}/g, employee.name);
    return generateEmail(employee.email, subject, personalizedBody);
  });
}
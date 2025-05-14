// Proxy per le funzioni API di Vercel
try {
  // Tentiamo di importare il file dal percorso corretto
  const server = require('../dist/index.js');
  
  // Esportiamo il gestore delle richieste
  if (typeof server === 'function') {
    // Il modulo è direttamente una funzione handler
    module.exports = server;
  } else if (server && (server.default || server.handler)) {
    // Il modulo ha un export default o named export 'handler'
    module.exports = server.default || server.handler;
  } else {
    // Errore: formato modulo non riconosciuto
    console.error('ERRORE: Formato del modulo server non riconosciuto');
    module.exports = (req, res) => {
      res.status(500).send('Errore interno del server: formato modulo non valido');
    };
  }
} catch (error) {
  // Errore di caricamento
  console.error('ERRORE CRITICO nel caricamento del server:', error);
  module.exports = (req, res) => {
    res.status(500).send(`Errore nel caricamento del server: ${error.message}`);
  };
} 
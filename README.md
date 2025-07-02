# Red Teaming Toolkit

Toolkit completo per attività di Red Teaming e Penetration Testing

---

## Cos'è il Red Teaming Toolkit?

Il **Red Teaming Toolkit** è una piattaforma moderna e modulare progettata per supportare attività di Red Teaming e penetration testing. Permette di simulare attacchi informatici, identificare vulnerabilità e produrre report dettagliati, aiutando aziende e professionisti a valutare e migliorare la sicurezza dei propri sistemi informativi.

Un Red Team è una task force (spesso esterna all'azienda) che esegue simulazioni di attacco per evidenziare criticità e debolezze dei sistemi, utilizzando tecniche che spaziano dall'ingegneria sociale allo sviluppo di malware ad-hoc.

---

## Obiettivi del Progetto

- Sviluppare un toolkit moderno e facilmente estendibile per il Red Teaming
- Integrare strumenti open source per la ricognizione, l'exploitation e il reporting
- Fornire una guida d'uso e una documentazione completa
- Favorire la didattica e la formazione pratica su tematiche di sicurezza
- Garantire la conformità alle normative vigenti (es. GDPR)

---

## Funzionalità Principali

- **Reconnaissance**: raccolta informazioni su target tramite Nmap, Amass e altri tool
- **Exploitation**: integrazione con Metasploit, generazione payload, simulazione attacchi
- **Reporting**: generazione automatica di report dettagliati
- **Gestione Progetti**: organizzazione delle attività e dei target per progetto
- **Interfaccia Web**: dashboard moderna e intuitiva per gestire tutte le operazioni

---

## Architettura del Toolkit

- **Frontend**: interfaccia web sviluppata in React
- **Backend**: API server in Flask (Python)
- **Database**: MySQL per la gestione di report, log e progetti
- **Containerizzazione**: supporto completo a Docker e Docker Compose per un deploy semplice e sicuro

---

## Installazione e Avvio Rapido

### Prerequisiti
- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/)
- (Opzionale) `make` per facilitare i comandi

### Clona la repository
```bash
git clone https://github.com/LorussoMarco/redteaming-toolkit.git
cd redteaming-toolkit
```


### Avvia il toolkit
```bash
# Costruisci le immagini (solo la prima volta)
make build

# Avvia tutti i servizi
make up
```

L'interfaccia sarà accessibile su [https://localhost:3000](https://localhost:3000)

---

## Guida all'Uso

1. **Crea un nuovo progetto**: organizza i target e le attività sotto un unico nome
2. **Esegui la ricognizione**: utilizza Nmap e Amass per raccogliere informazioni
3. **Sfrutta le vulnerabilità**: genera payload e integra Metasploit per simulare attacchi
4. **Consulta i report**: visualizza e scarica report dettagliati delle attività svolte
5. **Gestisci i log**: monitora tutte le operazioni tramite la sezione dedicata

Per dettagli e casi d'uso, consulta la documentazione allegata (`Documentazione.pdf`).

---

## Struttura delle Cartelle

- `backend/` — Backend Flask e moduli core
  - `app/` — Codice principale Flask
  - `modules/` — Moduli per le varie funzionalità (recon, exploit, report, ecc.)
- `frontend/` — Frontend React
  - `src/` — Codice sorgente
  - `public/` — Asset pubblici
- `docker/` — Configurazioni Docker
  - `backend/`, `frontend/`, `db/` — Dockerfile e script di init
  - `docker-compose.yml` — Configurazione produzione
  - `docker-compose.dev.yml` — Configurazione sviluppo

---

## Sicurezza e Best Practice

- **Usa solo in ambienti controllati**: il toolkit è pensato per test di sicurezza, non per attacchi reali
- **Cambia le credenziali di default** prima di ogni utilizzo in produzione
- **Isola la rete**: esegui i test in ambienti separati dalla rete aziendale reale
- **Security by design**: l'architettura segue i principi di sicurezza e minimizzazione dei rischi

---

## Documentazione e Manuali

- Manuale utente e documentazione tecnica disponibili nei file PDF nella root del progetto (`Documentazione.pdf`, `Biblioteca.pdf`, `Abstract.pdf`)
- Per domande o supporto, apri una issue su GitHub

---

## Contribuire

Contributi, segnalazioni di bug e suggerimenti sono benvenuti! Apri una issue o una pull request per partecipare allo sviluppo.


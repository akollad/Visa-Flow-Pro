#!/usr/bin/env npx tsx
/**
 * extract-bundle.ts
 * Extraction exhaustive du bundle Angular minifié → sections JSON structurées.
 *
 * Pour chaque endpoint/fonctionnalité du portail USA Visa, ce script extrait :
 *   - URL exacte + méthode HTTP
 *   - Headers de la requête (interceptor + headers propres à la fonction)
 *   - Corps de la requête (body/params)
 *   - Champs utilisés depuis la réponse (response field access)
 *   - Contexte brut du bundle (snippet ±500 chars autour de chaque match)
 *
 * Usage :
 *   npx tsx bundle-analysis/extract-bundle.ts
 *
 * Output :
 *   bundle-analysis/sections/<id>_<name>.json  (un fichier par endpoint)
 *   bundle-analysis/reports/bundle-summary.md  (rapport Markdown)
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUNDLE_PATH = path.join(__dirname, "bundle.js");
const SECTIONS_DIR = path.join(__dirname, "sections");
const REPORTS_DIR = path.join(__dirname, "reports");

fs.mkdirSync(SECTIONS_DIR, { recursive: true });
fs.mkdirSync(REPORTS_DIR, { recursive: true });

const txt = fs.readFileSync(BUNDLE_PATH, "utf8");
console.log(`[extract-bundle] Bundle chargé : ${(txt.length / 1024).toFixed(0)} KB`);

// ─── Utilitaires ────────────────────────────────────────────────────────────

/** Extrait N octets de contexte autour d'une position dans le bundle */
function ctx(pos: number, before = 400, after = 600): string {
  return txt.slice(Math.max(0, pos - before), Math.min(txt.length, pos + after));
}

/** Trouve toutes les occurrences d'un mot-clé et retourne les contextes */
function findAll(keyword: string, before = 400, after = 600): string[] {
  const results: string[] = [];
  let idx = 0;
  while (idx < txt.length) {
    const pos = txt.indexOf(keyword, idx);
    if (pos === -1) break;
    results.push(ctx(pos, before, after));
    idx = pos + 1;
  }
  return results;
}

/** Extrait la première occurrence avec contexte */
function findFirst(keyword: string, before = 400, after = 800): string | null {
  const pos = txt.indexOf(keyword);
  if (pos === -1) return null;
  return ctx(pos, before, after);
}

/** Extrait tous les snippets contenant l'un des mots-clés */
function findAny(keywords: string[], before = 400, after = 800): Array<{ keyword: string; context: string }> {
  const results: Array<{ keyword: string; context: string }> = [];
  for (const kw of keywords) {
    const all = findAll(kw, before, after);
    for (const c of all) {
      results.push({ keyword: kw, context: c });
    }
  }
  return results;
}

/** Extrait les patterns http.METHOD('url') du bundle */
function extractHttpCalls(
  urlFragment: string,
  before = 600,
  after = 800
): Array<{ method: string; urlContext: string; fullContext: string }> {
  const results: Array<{ method: string; urlContext: string; fullContext: string }> = [];
  const methods = ["get", "post", "put", "delete", "patch"];
  for (const method of methods) {
    let idx = 0;
    while (idx < txt.length) {
      // Cherche .get("...urlFragment...") ou .post(`...urlFragment...`)
      const pos = txt.indexOf(urlFragment, idx);
      if (pos === -1) break;
      // Vérifie que c'est bien dans un appel HTTP
      const surroundBefore = txt.slice(Math.max(0, pos - 50), pos);
      const matchMethod = surroundBefore.match(new RegExp(`\\.${method}[^a-z]`));
      if (matchMethod) {
        results.push({
          method: method.toUpperCase(),
          urlContext: txt.slice(Math.max(0, pos - 80), pos + urlFragment.length + 80),
          fullContext: ctx(pos, before, after),
        });
      }
      idx = pos + 1;
    }
  }
  return results;
}

// ─── Définition des sections à extraire ─────────────────────────────────────

interface SectionDef {
  id: string;
  name: string;
  description: string;
  searchKeywords: string[];     // Mots-clés pour trouver le code dans le bundle
  urlFragments: string[];       // Fragments d'URL pour extractHttpCalls
  responseKeywords: string[];   // Champs lus dans les réponses
  expectedMethod?: string;      // GET | POST | PUT | DELETE
  expectedUrl?: string;         // URL exacte attendue
}

const SECTIONS: SectionDef[] = [
  // ── 1. Login ──────────────────────────────────────────────────────────────
  {
    id: "01",
    name: "login",
    description: "POST /identity/user/login — Authentification initiale avec credentials AES-chiffrés",
    searchKeywords: [
      "loginUser(",
      "authorization:\"Basic \"+this.cryptoService.encrypt",
      "isActive",
      "Csrftoken",
      "loggedInApplicantUser",
    ],
    urlFragments: ["/login"],
    responseKeywords: [
      "isActive",
      "userID",
      "userName",
      "fullName",
      "mfa",
      "firstTimeLogin",
      "Csrftoken",
      "Authorization",
      "refreshtoken",
    ],
    expectedMethod: "POST",
    expectedUrl: "/identity/user/login",
  },

  // ── 2. MFA / verifyMfa ────────────────────────────────────────────────────
  {
    id: "02",
    name: "verifyMfa",
    description: "POST /identity/verifyMfa — Validation OTP pour comptes avec MFA activé",
    searchKeywords: ["verifyMfa", "mfa:H.mfa", "varifyMfa"],
    urlFragments: ["/verifyMfa"],
    responseKeywords: ["mfa", "saveToken", "loggedInApplicantUser"],
    expectedMethod: "POST",
    expectedUrl: "/identity/verifyMfa",
  },

  // ── 3. Refresh Token ──────────────────────────────────────────────────────
  {
    id: "03",
    name: "refreshToken",
    description: "POST /identity/refreshToken — Renouvellement du JWT",
    searchKeywords: ["refreshToken", "handle401Error", "fetchN"],
    urlFragments: ["/refreshToken"],
    responseKeywords: ["Authorization", "refreshtoken"],
    expectedMethod: "POST",
    expectedUrl: "/identity/refreshToken",
  },

  // ── 4. Logout ─────────────────────────────────────────────────────────────
  {
    id: "04",
    name: "logout",
    description: "POST /identity/logout — Déconnexion",
    searchKeywords: ["logoutUser(", "/logout"],
    urlFragments: ["/logout"],
    responseKeywords: [],
    expectedMethod: "POST",
    expectedUrl: "/identity/logout",
  },

  // ── 5. getUserHistoryApplicantPaymentStatus ────────────────────────────────
  {
    id: "05",
    name: "paymentStatus",
    description: "GET /workflow/getUserHistoryApplicantPaymentStatus — Statut paiement & demande RDV",
    searchKeywords: [
      "getUserHistoryApplicantPaymentStatus",
      "pendingAppoStatus",
      "getAppIdByUserId",
    ],
    urlFragments: [
      "getUserHistoryApplicantPaymentStatus",
      "getAppIdByUserId",
    ],
    responseKeywords: [
      "pendingAppoStatus",
      "applicationId",
      "missionId",
      "applicantId",
      "appointmentId",
      "applicantUUID",
      "primaryApplicant",
    ],
    expectedMethod: "GET",
    expectedUrl: "/workflow/getUserHistoryApplicantPaymentStatus",
  },

  // ── 6. getApplicationDetails ──────────────────────────────────────────────
  {
    id: "06",
    name: "getApplicationDetails",
    description: "GET /appointments/getApplicationDetails — Détails demande (tableau), filtre appointmentStatus=NEW",
    searchKeywords: [
      "getApplicationDetails",
      "getappointmentByApplicationId",
      "relatedAppList",
      "appointmentStatus",
    ],
    urlFragments: ["getApplicationDetails"],
    responseKeywords: [
      "applicantId",
      "applicationId",
      "visaType",
      "visaClass",
      "appointmentId",
      "applicantUUID",
      "appointmentStatus",
      "appointmentLocationType",
    ],
    expectedMethod: "GET",
    expectedUrl: "/appointments/getApplicationDetails?applicationId=&applicantId=",
  },

  // ── 7. getLandingPageDeatils (typo portail) ───────────────────────────────
  {
    id: "07",
    name: "getLandingPage",
    description: "GET /appointment/getLandingPageDeatils — Page d'accueil du portail (warm-up + LanguageId header)",
    searchKeywords: ["getLandingPageDeatils", "LanguageId"],
    urlFragments: ["getLandingPageDeatils"],
    responseKeywords: [],
    expectedMethod: "GET",
    expectedUrl: "/appointment/getLandingPageDeatils",
  },

  // ── 8. OFC List ───────────────────────────────────────────────────────────
  {
    id: "08",
    name: "ofcList",
    description: "GET /ofcuser/ofclist/{missionId} ou /lookupcdt/wizard/getpost — Liste des OFCs",
    searchKeywords: [
      "ofcuser/ofclist",
      "getFilteredOfcPostList",
      "getOfcListByMissionId",
      "ofcName",
      "officeType",
    ],
    urlFragments: ["ofcuser/ofclist", "lookupcdt/wizard/getpost"],
    responseKeywords: [
      "postUserId",
      "ofcName",
      "officeType",
      "postCode",
    ],
    expectedMethod: "GET",
    expectedUrl: "/ofcuser/ofclist/{missionId}",
  },

  // ── 9. getFirstAvailableMonth ─────────────────────────────────────────────
  {
    id: "09",
    name: "getFirstAvailableMonth",
    description: "POST /modifyslot/getFirstAvailableMonth — Premier mois avec créneaux disponibles",
    searchKeywords: ["getFirstAvailableMonth", "B.present", "B.date"],
    urlFragments: ["getFirstAvailableMonth"],
    responseKeywords: ["present", "date"],
    expectedMethod: "POST",
    expectedUrl: "/modifyslot/getFirstAvailableMonth",
  },

  // ── 10. getSlotDates ──────────────────────────────────────────────────────
  {
    id: "10",
    name: "getSlotDates",
    description: "POST /modifyslot/getSlotDates — Liste des dates avec créneaux disponibles",
    searchKeywords: ["getSlotDates", "listSlot(", "slotsAvailable"],
    urlFragments: ["getSlotDates"],
    responseKeywords: ["date", "slotsAvailable"],
    expectedMethod: "POST",
    expectedUrl: "/modifyslot/getSlotDates",
  },

  // ── 11. getSlotTime ───────────────────────────────────────────────────────
  {
    id: "11",
    name: "getSlotTime",
    description: "POST /modifyslot/getSlotTime — Liste des horaires pour une date donnée",
    searchKeywords: [
      "getSlotTime",
      "getTimeSlot(",
      "filterSlots(",
      "slotDate:je",
      "UItime",
      "setUItime",
      "setTimeList(",
    ],
    urlFragments: ["getSlotTime"],
    responseKeywords: [
      "slotId",
      "startTime",
      "endTime",
      "date",
      "slotDate",
      "UItime",
      "slotsAvailable",
    ],
    expectedMethod: "POST",
    expectedUrl: "/modifyslot/getSlotTime",
  },

  // ── 12. bookSlot / PUT schedule ───────────────────────────────────────────
  {
    id: "12",
    name: "bookSlot",
    description: "PUT /appointments/schedule — Réservation du créneau (10 champs exacts)",
    searchKeywords: [
      "bookSlot(",
      "initBookSlot(",
      "appointments/schedule",
      "appointmentStatus:\"SCHEDULED\"",
      "appointmentLocationType",
    ],
    urlFragments: ["appointments/schedule"],
    responseKeywords: [
      "responseMsg",
      "appointmentId",
    ],
    expectedMethod: "PUT",
    expectedUrl: "/appointments/schedule",
  },

  // ── 13. rescheduleAppointment ─────────────────────────────────────────────
  {
    id: "13",
    name: "rescheduleAppointment",
    description: "PUT /appointments/reschedule — Reprogrammation d'un RDV existant",
    searchKeywords: ["rescheduleAppointment", "initRescheduleSlot", "/appointments/reschedule"],
    urlFragments: ["/appointments/reschedule"],
    responseKeywords: [],
    expectedMethod: "PUT",
    expectedUrl: "/appointments/reschedule",
  },

  // ── 14. HTTP Interceptor (headers globaux) ────────────────────────────────
  {
    id: "14",
    name: "httpInterceptor",
    description: "Intercepteur Angular — headers ajoutés automatiquement sur toutes les requêtes authentifiées",
    searchKeywords: [
      "tokenStorage.getToken()",
      "Bearer ${Ce}",
      "Content-Type.*application/json",
      "LanguageId",
      "/getLandingPageDeatils",
    ],
    urlFragments: [],
    responseKeywords: [],
    expectedMethod: "ALL",
    expectedUrl: "Intercepteur global",
  },

  // ── 15. Sanity Check / FCS ────────────────────────────────────────────────
  {
    id: "15",
    name: "sanityCheck",
    description: "GET — Vérification état du workflow (FCS payment check) avant réservation",
    searchKeywords: [
      "checkForPendingAppointmentApplicant",
      "slotBooking",
      "getFcsPaymentDetails",
      "isLivepayAvailable",
      "fcs",
    ],
    urlFragments: [
      "isLivepayAvailable",
      "fcs",
      "checkForPendingAppointment",
    ],
    responseKeywords: [],
    expectedMethod: "GET",
    expectedUrl: "TBD — voir contexte",
  },

  // ── 16. Appointment Letter ────────────────────────────────────────────────
  {
    id: "16",
    name: "appointmentLetter",
    description: "POST /template/appointmentLetter — Génération du document de confirmation",
    searchKeywords: ["appointmentLetter", "downloadAppointment"],
    urlFragments: ["appointmentLetter"],
    responseKeywords: [],
    expectedMethod: "POST",
    expectedUrl: "/template/appointmentLetter",
  },

  // ── 17. CSRF & Cookie Mechanics ───────────────────────────────────────────
  {
    id: "17",
    name: "csrfAndCookies",
    description: "Mécanismes CSRF (CookieName, XSRF-TOKEN) et cookies (APP_ID_TOBE, missionId, applicantId)",
    searchKeywords: [
      "XSRF-TOKEN",
      "CookieName",
      "X-XSRF-TOKEN",
      "APP_ID_TOBE",
      "missionId",
      "sessionStorage.setItem(\"applicantId\"",
      "sessionStorage.setItem(\"appointmentId\"",
      "sessionStorage.setItem(\"applicantUUID\"",
    ],
    urlFragments: [],
    responseKeywords: [],
    expectedMethod: "N/A",
    expectedUrl: "Mécanique transversale",
  },

  // ── 18. Encryption / Crypto ───────────────────────────────────────────────
  {
    id: "18",
    name: "cryptoEncryption",
    description: "Chiffrement AES-256-CBC des credentials (PBKDF2 SHA1, 1000 iter, 32 bytes)",
    searchKeywords: [
      "PBKDF2",
      "AES",
      "encrypt(",
      "cryptoService",
      "iv_hex",
      "salt_hex",
    ],
    urlFragments: [],
    responseKeywords: [],
    expectedMethod: "N/A",
    expectedUrl: "Bibliothèque interne",
  },

  // ── 19. bookSlot — construction détaillée du payload ─────────────────────
  {
    id: "19",
    name: "bookSlotPayloadConstruction",
    description: "Détail complet de la construction du payload PUT /schedule : bookSlot() + initBookSlot()",
    searchKeywords: [
      "bookSlot(){",
      "bookSlot(){\n",
      "this.selectedSlot.slotId",
      "this.selectedSlot.slotDate",
      "this.selectedSlot.UItime",
      "De.postUserId=this.selectedOfc",
      "De.applicantId=",
      "De.applicationId=this.applicationId",
    ],
    urlFragments: [],
    responseKeywords: [],
    expectedMethod: "N/A",
    expectedUrl: "Construction payload",
  },

  // ── 20. Token Storage (sessionStorage) ────────────────────────────────────
  {
    id: "20",
    name: "tokenStorage",
    description: "Gestion des tokens (saveToken/getToken/removeToken via sessionStorage)",
    searchKeywords: [
      "saveToken(",
      "getToken()",
      "removeToken()",
      "getRefreshToken()",
      "setRefreshToken(",
      "sessionStorage.setItem(\"AuthToken\"",
      "sessionStorage.getItem(\"AuthToken\"",
    ],
    urlFragments: [],
    responseKeywords: [],
    expectedMethod: "N/A",
    expectedUrl: "SessionStorage interne",
  },
];

// ─── Extraction ───────────────────────────────────────────────────────────────

interface SectionResult {
  id: string;
  name: string;
  description: string;
  expectedMethod: string;
  expectedUrl: string;
  httpCalls: Array<{ method: string; urlContext: string; fullContext: string }>;
  keywordContexts: Array<{ keyword: string; context: string }>;
  totalMatches: number;
}

const allResults: SectionResult[] = [];

for (const section of SECTIONS) {
  console.log(`\n[${section.id}] ${section.name} — extraction...`);

  const httpCalls: Array<{ method: string; urlContext: string; fullContext: string }> = [];
  for (const urlFrag of section.urlFragments) {
    const calls = extractHttpCalls(urlFrag);
    httpCalls.push(...calls);
    if (calls.length > 0) {
      console.log(`  → ${calls.length} appel(s) HTTP trouvé(s) pour "${urlFrag}"`);
    }
  }

  const keywordContexts = findAny(section.searchKeywords, 300, 700);
  console.log(`  → ${keywordContexts.length} contexte(s) mot-clé trouvé(s)`);

  const result: SectionResult = {
    id: section.id,
    name: section.name,
    description: section.description,
    expectedMethod: section.expectedMethod ?? "UNKNOWN",
    expectedUrl: section.expectedUrl ?? "UNKNOWN",
    httpCalls,
    keywordContexts,
    totalMatches: httpCalls.length + keywordContexts.length,
  };

  allResults.push(result);

  const outPath = path.join(SECTIONS_DIR, `${section.id}_${section.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`  → Sauvegardé : sections/${section.id}_${section.name}.json`);
}

// ─── Rapport Markdown ─────────────────────────────────────────────────────────

const now = new Date().toISOString().slice(0, 10);
const lines: string[] = [
  `# Bundle Analysis — Extraction Automatique`,
  ``,
  `**Bundle :** \`main.dc91e3f7b5f67caa.js\` (${(txt.length / 1024).toFixed(0)} KB)`,
  `**Date extraction :** ${now}`,
  `**Total sections :** ${SECTIONS.length}`,
  ``,
  `---`,
  ``,
  `## Index des sections`,
  ``,
  `| ID | Section | Méthode | URL | Matches |`,
  `|----|---------|---------|-----|---------|`,
];

for (const r of allResults) {
  lines.push(`| ${r.id} | ${r.name} | \`${r.expectedMethod}\` | \`${r.expectedUrl}\` | ${r.totalMatches} |`);
}

lines.push(``, `---`, ``);

for (const r of allResults) {
  lines.push(`## [${r.id}] ${r.name}`);
  lines.push(``);
  lines.push(`**Description :** ${r.description}`);
  lines.push(``);
  lines.push(`**Méthode :** \`${r.expectedMethod}\``);
  lines.push(`**URL :** \`${r.expectedUrl}\``);
  lines.push(`**Total contextes extraits :** ${r.totalMatches}`);
  lines.push(``);

  if (r.httpCalls.length > 0) {
    lines.push(`### Appels HTTP trouvés (${r.httpCalls.length})`);
    lines.push(``);
    for (let i = 0; i < Math.min(r.httpCalls.length, 3); i++) {
      const call = r.httpCalls[i];
      lines.push(`**Appel #${i + 1} — ${call.method}**`);
      lines.push("```js");
      lines.push(call.fullContext.replace(/```/g, "\\`\\`\\`").trim().slice(0, 1000));
      lines.push("```");
      lines.push(``);
    }
  }

  if (r.keywordContexts.length > 0) {
    lines.push(`### Contextes clés (${Math.min(r.keywordContexts.length, 3)} sur ${r.keywordContexts.length})`);
    lines.push(``);
    for (let i = 0; i < Math.min(r.keywordContexts.length, 3); i++) {
      const kc = r.keywordContexts[i];
      lines.push(`**Mot-clé :** \`${kc.keyword}\``);
      lines.push("```js");
      lines.push(kc.context.replace(/```/g, "\\`\\`\\`").trim().slice(0, 800));
      lines.push("```");
      lines.push(``);
    }
  }

  lines.push(`---`, ``);
}

const reportPath = path.join(REPORTS_DIR, "bundle-summary.md");
fs.writeFileSync(reportPath, lines.join("\n"));
console.log(`\n✅ Rapport Markdown : reports/bundle-summary.md`);
console.log(`✅ ${SECTIONS.length} sections JSON dans sections/`);
console.log(`\nExtraction terminée.`);

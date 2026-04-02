#!/usr/bin/env npx tsx
/**
 * extract-bot.ts
 * Extraction exhaustive du bot (usaPortal.ts) → sections JSON structurées.
 *
 * Pour chaque endpoint/fonctionnalité, ce script extrait :
 *   - URL exacte + méthode HTTP
 *   - Headers envoyés
 *   - Corps de la requête (body/params)
 *   - Champs lus dans la réponse
 *   - Contexte source brut (snippet ±300 chars)
 *
 * Usage :
 *   npx tsx bundle-analysis/extract-bot.ts
 *
 * Output :
 *   bundle-analysis/bot-sections/<id>_<name>.json
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_PATH = path.join(__dirname, "../src/usaPortal.ts");
const BOT_SECTIONS_DIR = path.join(__dirname, "bot-sections");
const REPORTS_DIR = path.join(__dirname, "reports");

fs.mkdirSync(BOT_SECTIONS_DIR, { recursive: true });
fs.mkdirSync(REPORTS_DIR, { recursive: true });

const txt = fs.readFileSync(BOT_PATH, "utf8");
const lines = txt.split("\n");

console.log(`[extract-bot] usaPortal.ts chargé : ${lines.length} lignes`);

// ─── Utilitaires ─────────────────────────────────────────────────────────────

/** Trouve tous les numéros de ligne contenant un mot-clé */
function findLines(keyword: string): number[] {
  return lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.includes(keyword))
    .map(({ i }) => i);
}

/** Extrait un bloc de lignes (±N lignes autour d'un numéro de ligne) */
function blockAround(lineNo: number, before = 5, after = 20): string {
  const start = Math.max(0, lineNo - before);
  const end = Math.min(lines.length - 1, lineNo + after);
  return lines.slice(start, end + 1).map((l, i) => `${start + i + 1}: ${l}`).join("\n");
}

/** Extrait un contexte autour d'un mot-clé (toutes occurrences) */
function findAll(keyword: string, before = 5, after = 20): Array<{ lineNo: number; context: string }> {
  const results: Array<{ lineNo: number; context: string }> = [];
  for (const lineNo of findLines(keyword)) {
    results.push({ lineNo: lineNo + 1, context: blockAround(lineNo, before, after) });
  }
  return results;
}

/** Extrait les constantes d'URL définies dans le bot */
function extractUrlConstants(): Record<string, string> {
  const constants: Record<string, string> = {};
  const regex = /const\s+(USA_\w+URL\w*|USA_\w+_URL)\s*=\s*`?([^;`\n]+)`?/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(txt)) !== null) {
    constants[m[1]] = m[2].trim();
  }
  return constants;
}

/** Extrait les interfaces TypeScript définies dans le bot */
function extractInterfaces(): Record<string, string[]> {
  const interfaces: Record<string, string[]> = {};
  const interfaceRegex = /interface\s+(\w+)\s*\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = interfaceRegex.exec(txt)) !== null) {
    const name = m[1];
    const body = m[2];
    const fields = body
      .split("\n")
      .map(l => l.trim())
      .filter(l => l && !l.startsWith("//") && !l.startsWith("/**") && !l.startsWith("*"));
    interfaces[name] = fields;
  }
  return interfaces;
}

/** Extrait les async functions (API calls) du bot */
function extractAsyncFunctions(): Array<{ name: string; lineNo: number; signature: string }> {
  const fns: Array<{ name: string; lineNo: number; signature: string }> = [];
  lines.forEach((line, i) => {
    const m = line.match(/async function (\w+)\s*\(/);
    if (m) {
      fns.push({ name: m[1], lineNo: i + 1, signature: line.trim() });
    }
  });
  return fns;
}

// ─── Définition des sections bot ─────────────────────────────────────────────

interface BotSectionDef {
  id: string;
  name: string;
  description: string;
  functionKeyword: string;   // Nom de la fonction principale
  urlConstant?: string;      // Nom de la constante URL
  searchKeywords: string[];  // Autres mots-clés à chercher dans le bot
}

const BOT_SECTIONS: BotSectionDef[] = [
  {
    id: "01",
    name: "login",
    description: "loginUsaPortal() — POST /identity/user/login",
    functionKeyword: "loginUsaPortal",
    urlConstant: "USA_LOGIN_URL",
    searchKeywords: [
      "USA_LOGIN_URL",
      "encryptPortalCredentials",
      "authorization.*Basic",
      "response.headers.get(\"authorization\")",
      "data.isActive",
      "data.userID",
      "data.mfa",
      "data.firstTimeLogin",
    ],
  },
  {
    id: "02",
    name: "tokenRefresh",
    description: "fetchNewRefreshToken() — POST /identity/refreshToken",
    functionKeyword: "fetchNewRefreshToken",
    urlConstant: "USA_REFRESH_URL",
    searchKeywords: [
      "USA_REFRESH_URL",
      "refreshToken",
      "newAccessToken",
      "newRefreshToken",
    ],
  },
  {
    id: "03",
    name: "paymentStatus",
    description: "checkUsaAppointmentRequestStatus() — GET /workflow/getUserHistoryApplicantPaymentStatus",
    functionKeyword: "checkUsaAppointmentRequestStatus",
    urlConstant: "USA_PAYMENT_STATUS_URL",
    searchKeywords: [
      "USA_PAYMENT_STATUS_URL",
      "pendingAppoStatus",
      "serverAppointmentId",
      "serverApplicantUUID",
      "serverApplicantId",
      "serverMissionId",
    ],
  },
  {
    id: "04",
    name: "getApplicationDetails",
    description: "getUsaApplicationDetails() — GET /appointments/getApplicationDetails",
    functionKeyword: "getUsaApplicationDetails",
    urlConstant: "USA_APP_DETAILS_URL",
    searchKeywords: [
      "USA_APP_DETAILS_URL",
      "applicantIdParam",
      "appointmentStatus.*NEW",
      "newItems",
      "data.appointmentId",
      "data.applicantUUID",
    ],
  },
  {
    id: "05",
    name: "landingPage",
    description: "callLandingPage() — GET /appointment/getLandingPageDeatils (+ LanguageId)",
    functionKeyword: "callLandingPage",
    urlConstant: "USA_LANDING_URL",
    searchKeywords: [
      "USA_LANDING_URL",
      "LanguageId",
    ],
  },
  {
    id: "06",
    name: "ofcList",
    description: "getUsaOfcList() — GET /ofcuser/ofclist/{missionId}",
    functionKeyword: "getUsaOfcList",
    urlConstant: "USA_OFC_LIST_URL",
    searchKeywords: [
      "USA_OFC_LIST_URL",
      "officeType.*OFC",
      "o.postName",
    ],
  },
  {
    id: "07",
    name: "getFirstAvailableMonth",
    description: "findFirstSlotForOfc() → getFirstAvailableMonth — POST /modifyslot/getFirstAvailableMonth",
    functionKeyword: "findFirstSlotForOfc",
    urlConstant: "USA_FIRST_MONTH_URL",
    searchKeywords: [
      "USA_FIRST_MONTH_URL",
      "getFirstAvailableMonth",
      "firstMonth.date",
      "present",
    ],
  },
  {
    id: "08",
    name: "getSlotDates",
    description: "findFirstSlotForOfc() → getSlotDates — POST /modifyslot/getSlotDates",
    functionKeyword: "USA_SLOT_DATES_URL",
    urlConstant: "USA_SLOT_DATES_URL",
    searchKeywords: [
      "USA_SLOT_DATES_URL",
      "basePayload.*fromDate.*toDate",
      "slotDates",
    ],
  },
  {
    id: "09",
    name: "getSlotTime",
    description: "findFirstSlotForOfc() → getSlotTime — POST /modifyslot/getSlotTime",
    functionKeyword: "USA_SLOT_TIMES_URL",
    urlConstant: "USA_SLOT_TIMES_URL",
    searchKeywords: [
      "USA_SLOT_TIMES_URL",
      "slotTimePayload",
      "timeSlots",
      "fromDate.*toDate",
    ],
  },
  {
    id: "10",
    name: "bookSlot",
    description: "bookUsaSlot() — PUT /appointments/schedule",
    functionKeyword: "bookUsaSlot",
    urlConstant: "USA_BOOK_URL",
    searchKeywords: [
      "USA_BOOK_URL",
      "UsaBookingPayload",
      "appointmentId.*session.appointmentId",
      "applicantUUID.*session.applicantUUID",
      "appointmentLocationType.*OFC",
      "appointmentStatus.*SCHEDULED",
      "appointmentDt",
      "appointmentTime",
      "formatUItime",
      "postUserId",
      "applicantId",
      "applicationId",
    ],
  },
  {
    id: "11",
    name: "csrfAndHeaders",
    description: "authHeaders() + sessionHeaders() + getBrowserHeaders() — Headers transversaux",
    functionKeyword: "authHeaders",
    searchKeywords: [
      "authHeaders",
      "sessionHeaders",
      "getBrowserHeaders",
      "CookieName.*XSRF-TOKEN",
      "X-XSRF-TOKEN",
      "csrfToken",
      "Content-Type.*application/json",
      "Authorization.*Bearer",
      "Sec-Fetch",
      "Accept-Encoding.*zstd",
    ],
  },
  {
    id: "12",
    name: "encryptCredentials",
    description: "encryptPortalCredentials() — PBKDF2 SHA1 + AES-256-CBC",
    functionKeyword: "encryptPortalCredentials",
    urlConstant: "USA_ENC_SEC_KEY",
    searchKeywords: [
      "encryptPortalCredentials",
      "USA_ENC_SEC_KEY",
      "PBKDF2",
      "AES",
      "iv_hex",
      "salt_hex",
    ],
  },
  {
    id: "13",
    name: "tokenCache",
    description: "getOrRefreshSession() + tokenCache — Gestion JWT + cache 55 min",
    functionKeyword: "getOrRefreshSession",
    searchKeywords: [
      "tokenCache",
      "getOrRefreshSession",
      "isCachedTokenValid",
      "TOKEN_VALIDITY_MS",
      "TOKEN_REFRESH_BUFFER_MS",
    ],
  },
  {
    id: "14",
    name: "sanityCheck",
    description: "callSanityCheck() + checkFcsPayment() — Vérifications avant booking",
    functionKeyword: "callSanityCheck",
    searchKeywords: [
      "callSanityCheck",
      "checkFcsPayment",
      "sanityCheck",
      "fcsOk",
    ],
  },
  {
    id: "15",
    name: "interfaces",
    description: "Toutes les interfaces TypeScript du bot (UsaSession, UsaAppDetails, UsaBookingPayload, etc.)",
    functionKeyword: "interface Usa",
    searchKeywords: [
      "interface UsaSession",
      "interface UsaLoginResponse",
      "interface UsaAppointmentRequest",
      "interface UsaAppDetails",
      "interface UsaOfc",
      "interface UsaFirstAvailableMonthResponse",
      "interface UsaSlotDate",
      "interface UsaTimeSlot",
      "interface UsaBookingPayload",
      "interface UsaBookingResult",
    ],
  },
  {
    id: "16",
    name: "urlConstants",
    description: "Toutes les constantes d'URL du bot",
    functionKeyword: "USA_",
    searchKeywords: [
      "USA_BASE_URL",
      "USA_ADMIN_URL",
      "USA_APPOINTMENT_URL",
      "USA_AUTH_URL",
      "USA_WORKFLOW_URL",
      "USA_NOTIFICATION_URL",
      "USA_MISSION_ID",
    ],
  },
];

// ─── Extraction ───────────────────────────────────────────────────────────────

const urlConstants = extractUrlConstants();
const interfaces = extractInterfaces();
const asyncFunctions = extractAsyncFunctions();

console.log(`\n[extract-bot] Constants URL trouvées : ${Object.keys(urlConstants).length}`);
console.log(`[extract-bot] Interfaces trouvées : ${Object.keys(interfaces).length}`);
console.log(`[extract-bot] Fonctions async trouvées : ${asyncFunctions.length}`);

interface BotSectionResult {
  id: string;
  name: string;
  description: string;
  urlConstantValue: string | null;
  functionLines: number[];
  keywordContexts: Array<{ keyword: string; lineNo: number; context: string }>;
  totalMatches: number;
}

const allResults: BotSectionResult[] = [];

for (const section of BOT_SECTIONS) {
  console.log(`\n[${section.id}] ${section.name} — extraction...`);

  const urlConstantValue = section.urlConstant ? (urlConstants[section.urlConstant] ?? null) : null;
  if (urlConstantValue) {
    console.log(`  → URL: ${urlConstantValue}`);
  }

  const functionLines = findLines(section.functionKeyword).map(l => l + 1);
  console.log(`  → Mot-clé fonction "${section.functionKeyword}": ${functionLines.length} ligne(s)`);

  const keywordContexts: Array<{ keyword: string; lineNo: number; context: string }> = [];
  for (const kw of section.searchKeywords) {
    const found = findAll(kw, 3, 15);
    for (const f of found) {
      keywordContexts.push({ keyword: kw, lineNo: f.lineNo, context: f.context });
    }
    if (found.length > 0) {
      console.log(`  → "${kw}": ${found.length} occurrence(s)`);
    }
  }

  const result: BotSectionResult = {
    id: section.id,
    name: section.name,
    description: section.description,
    urlConstantValue,
    functionLines,
    keywordContexts,
    totalMatches: keywordContexts.length,
  };

  allResults.push(result);

  const outPath = path.join(BOT_SECTIONS_DIR, `${section.id}_${section.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`  → Sauvegardé : bot-sections/${section.id}_${section.name}.json`);
}

// Sauvegarder les constantes URL et interfaces
fs.writeFileSync(
  path.join(BOT_SECTIONS_DIR, "00_urlConstants.json"),
  JSON.stringify({ urlConstants, asyncFunctions, interfaces }, null, 2)
);

console.log(`\n✅ ${BOT_SECTIONS.length} sections JSON dans bot-sections/`);
console.log(`✅ Constantes URL et interfaces dans bot-sections/00_urlConstants.json`);

import * as dotenv from "dotenv";
dotenv.config();

import { getActiveJobs, sendHeartbeat, getPendingBotTest, type HunterJob } from "./convexClient.js";
import { runHunterSession, runBotTestSession, type SessionResult } from "./navigator.js";

// ─── Tier intervals : temps MINIMUM entre deux checks du MÊME dossier ──────
const URGENCY_INTERVAL: Record<string, { min: number; max: number }> = {
  tres_urgent:  { min:  8 * 60_000, max: 12 * 60_000 },
  urgent:       { min: 15 * 60_000, max: 20 * 60_000 },
  prioritaire:  { min: 25 * 60_000, max: 35 * 60_000 },
  standard:     { min: 45 * 60_000, max: 60 * 60_000 },
};

// ─── Silence Radio : IP cooldown entre deux incursions consécutives ─────────
const SILENCE_RADIO_MIN_MS = 3 * 60_000;
const SILENCE_RADIO_MAX_MS = 5 * 60_000;

// ─── Polling quand aucun job n'est dû ───────────────────────────────────────
const IDLE_POLL_MIN_MS = 60_000;
const IDLE_POLL_MAX_MS = 90_000;

const URGENCY_ORDER: Record<string, number> = {
  tres_urgent: 0,
  urgent: 1,
  prioritaire: 2,
  standard: 3,
};

const MAX_LOGIN_FAILURES = 3;
// Auto-pause après N erreurs transitoires consécutives (429/403/réseau) sur le même dossier.
// Évite d'harceler le portail en boucle si le compte est rate-limité ou bloqué.
const MAX_CONSECUTIVE_ERRORS = 5;

const consecutiveLoginFailures = new Map<string, number>();
const consecutiveErrors = new Map<string, number>();
const pausedJobs = new Set<string>();

function log(level: "INFO" | "WARN" | "ERROR", msg: string): void {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level}] ${msg}`);
}

/**
 * Prochaine échéance planifiée par job, calculée une seule fois après chaque cycle.
 * Séparé de getIntervalMs pour éviter les effets de bord lors des appels multiples
 * à getNextCheckDue dans le même tour de boucle (filter + sort + getTimeUntilNextDue).
 */
const scheduledNextDue = new Map<string, number>();

/**
 * Génère un intervalle aléatoire pour un tier, en évitant de répéter
 * une valeur trop proche de la dernière utilisée pour ce tier.
 * À appeler UNE SEULE FOIS par cycle (dans handleResult), pas dans getNextCheckDue.
 */
const lastIntervalUsed = new Map<string, number>();
function generateIntervalMs(urgencyTier: string): number {
  const cfg = URGENCY_INTERVAL[urgencyTier] ?? URGENCY_INTERVAL.standard;
  const last = lastIntervalUsed.get(urgencyTier);
  let interval = cfg.min + Math.random() * (cfg.max - cfg.min);

  if (last !== undefined) {
    let attempts = 0;
    while (Math.abs(interval - last) < 90_000 && attempts < 6) {
      interval = cfg.min + Math.random() * (cfg.max - cfg.min);
      attempts++;
    }
  }

  lastIntervalUsed.set(urgencyTier, interval);
  return Math.round(interval);
}

function getSilenceRadioMs(): number {
  return Math.round(SILENCE_RADIO_MIN_MS + Math.random() * (SILENCE_RADIO_MAX_MS - SILENCE_RADIO_MIN_MS));
}

function formatMs(ms: number): string {
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return `${min}m${sec}s`;
}

/**
 * Retourne l'heure planifiée pour le prochain check du job.
 * Lit depuis scheduledNextDue (calculé une seule fois dans handleResult).
 * Si aucune valeur n'est encore planifiée (premier cycle), retourne 0 → dû immédiatement.
 */
function getNextCheckDue(job: HunterJob): number {
  const scheduled = scheduledNextDue.get(job.id);
  if (scheduled !== undefined) return scheduled;
  // Fallback : si Convex a un lastCheckAt, utiliser un intervalle minimum fixe
  const lastCheck = job.lastCheckAt ?? job.hunterConfig.lastCheckAt;
  if (!lastCheck) return 0;
  const cfg = URGENCY_INTERVAL[job.urgencyTier] ?? URGENCY_INTERVAL.standard;
  return lastCheck + cfg.min;
}

function findNextDueJob(jobs: HunterJob[]): HunterJob | null {
  const now = Date.now();

  const due = jobs.filter((j) =>
    !pausedJobs.has(j.id) &&
    j.hunterConfig?.isActive === true &&
    !!j.portalUrl &&
    getNextCheckDue(j) <= now,
  );

  if (due.length === 0) return null;

  due.sort((a, b) => {
    const tierDiff = (URGENCY_ORDER[a.urgencyTier] ?? 3) - (URGENCY_ORDER[b.urgencyTier] ?? 3);
    if (tierDiff !== 0) return tierDiff;
    return getNextCheckDue(a) - getNextCheckDue(b);
  });

  return due[0];
}

function getTimeUntilNextDue(jobs: HunterJob[]): number {
  const now = Date.now();

  const active = jobs.filter((j) =>
    !pausedJobs.has(j.id) &&
    j.hunterConfig?.isActive === true &&
    !!j.portalUrl,
  );

  if (active.length === 0) return IDLE_POLL_MAX_MS;

  const minDue = Math.min(...active.map((j) => getNextCheckDue(j)));
  const waitMs = Math.max(minDue - now, 0);

  return Math.min(Math.max(waitMs, IDLE_POLL_MIN_MS), IDLE_POLL_MAX_MS);
}

function syncAdminResets(freshJobs: HunterJob[]): void {
  const freshJobIds = new Set(freshJobs.map((j) => j.id));

  for (const jobId of pausedJobs) {
    const freshJob = freshJobs.find((j) => j.id === jobId);
    if (freshJob && freshJob.hunterConfig.isActive) {
      log("INFO", `[${freshJob.applicantName}] Admin reset détecté — reprise`);
      pausedJobs.delete(jobId);
      consecutiveLoginFailures.delete(jobId);
      consecutiveErrors.delete(jobId);
      scheduledNextDue.delete(jobId);  // forcer un check immédiat après reset admin
    }
  }

  for (const jobId of consecutiveLoginFailures.keys()) {
    if (!freshJobIds.has(jobId)) consecutiveLoginFailures.delete(jobId);
  }
  for (const jobId of consecutiveErrors.keys()) {
    if (!freshJobIds.has(jobId)) consecutiveErrors.delete(jobId);
  }
  for (const jobId of scheduledNextDue.keys()) {
    if (!freshJobIds.has(jobId)) scheduledNextDue.delete(jobId);
  }
}

async function handleResult(job: HunterJob, result: SessionResult): Promise<void> {
  log("INFO", `[${job.applicantName}] Résultat: ${result}`);

  switch (result) {
    case "slot_found":
      consecutiveLoginFailures.delete(job.id);
      consecutiveErrors.delete(job.id);
      pausedJobs.add(job.id);
      log("INFO", `[${job.applicantName}] ✅ CRÉNEAU TROUVÉ — dossier retiré de la file`);
      return; // pas de reschedule : le job est terminé

    case "login_failed": {
      consecutiveErrors.delete(job.id);
      const loginFails = (consecutiveLoginFailures.get(job.id) ?? 0) + 1;
      consecutiveLoginFailures.set(job.id, loginFails);
      log("WARN", `[${job.applicantName}] Échec login #${loginFails}/${MAX_LOGIN_FAILURES}`);

      if (loginFails >= MAX_LOGIN_FAILURES) {
        pausedJobs.add(job.id);
        log("ERROR", `[${job.applicantName}] ${MAX_LOGIN_FAILURES} échecs consécutifs — auto-pause`);
        try {
          await sendHeartbeat({
            applicationId: job.id,
            result: "error",
            errorMessage: `Auto-paused: ${loginFails} login failures consécutives — vérifier les identifiants`,
            shouldPause: true,
          });
        } catch (err) {
          log("WARN", `[${job.applicantName}] Heartbeat pause échoué: ${err}`);
        }
        return; // pas de reschedule : le job est en pause
      }
      break;
    }

    case "error": {
      consecutiveLoginFailures.delete(job.id);
      const errCount = (consecutiveErrors.get(job.id) ?? 0) + 1;
      consecutiveErrors.set(job.id, errCount);
      log("WARN", `[${job.applicantName}] Erreur transitoire #${errCount}/${MAX_CONSECUTIVE_ERRORS} — prochain cycle selon tier`);

      // Auto-pause si le dossier génère trop d'erreurs consécutives (429/403/réseau)
      // pour éviter de harceler le portail en boucle sur un compte rate-limité
      if (errCount >= MAX_CONSECUTIVE_ERRORS) {
        pausedJobs.add(job.id);
        log("ERROR", `[${job.applicantName}] ${MAX_CONSECUTIVE_ERRORS} erreurs consécutives — auto-pause (compte potentiellement bloqué)`);
        try {
          await sendHeartbeat({
            applicationId: job.id,
            result: "error",
            errorMessage: `Auto-paused: ${errCount} erreurs transitoires consécutives — vérifier statut portail`,
            shouldPause: true,
          });
        } catch (err) {
          log("WARN", `[${job.applicantName}] Heartbeat pause échoué: ${err}`);
        }
        return; // pas de reschedule : le job est en pause
      }
      break;
    }

    case "captcha":
      log("WARN", `[${job.applicantName}] Bloqué par CAPTCHA — prochain cycle prévu selon tier`);
      break;

    case "payment_required":
      consecutiveLoginFailures.delete(job.id);
      consecutiveErrors.delete(job.id);
      log("WARN", `[${job.applicantName}] 💳 Paiement portail requis — frais consulaires non validés par le portail`);
      break;

    case "not_found":
      consecutiveLoginFailures.delete(job.id);
      consecutiveErrors.delete(job.id);
      log("INFO", `[${job.applicantName}] Aucun créneau disponible`);
      break;
  }

  // Planifier le prochain cycle : générer l'intervalle UNE SEULE FOIS ici,
  // stocké dans scheduledNextDue, lu de façon déterministe par getNextCheckDue.
  const intervalMs = generateIntervalMs(job.urgencyTier);
  const nextDue = Date.now() + intervalMs;
  scheduledNextDue.set(job.id, nextDue);
  log("INFO", `[${job.applicantName}] Prochain check dans ${formatMs(intervalMs)} (${new Date(nextDue).toLocaleTimeString("fr-CD")})`);
}

async function main(): Promise<void> {
  const dryRun = process.env.DRY_RUN === "true";
  const convexUrl = process.env.CONVEX_SITE_URL;
  const hunterKey = process.env.HUNTER_API_KEY;

  log("INFO", "=== Joventy Hunter démarrage (Joventy Shuffle v2) ===");
  log("INFO", `Mode: ${dryRun ? "DRY RUN" : "PRODUCTION"}`);
  log("INFO", `Convex: ${convexUrl ? "configuré" : "MANQUANT"}`);
  log("INFO", `Hunter API Key: ${hunterKey ? "configurée" : "MANQUANTE"}`);
  log("INFO", `Proxy: ${process.env.PROXY_URL ? "configuré" : "aucun"}`);
  log("INFO", "Intervalles tier — très_urgent:8-12m  urgent:15-20m  prioritaire:25-35m  standard:45-60m");
  log("INFO", `Silence radio inter-clients: ${formatMs(SILENCE_RADIO_MIN_MS)}–${formatMs(SILENCE_RADIO_MAX_MS)}`);
  log("INFO", `Auto-pause après: ${MAX_LOGIN_FAILURES} login_failed consécutifs`);

  if (!convexUrl || !hunterKey) {
    log("ERROR", "CONVEX_SITE_URL et HUNTER_API_KEY sont requis — arrêt");
    process.exit(1);
  }

  while (true) {
    try {
      const pendingTest = await getPendingBotTest();
      if (pendingTest) {
        log("INFO", `🧪 Test bot détecté — ${pendingTest.destination} (${pendingTest.portalUrl})`);
        try {
          await runBotTestSession(pendingTest);
          log("INFO", `🧪 Test bot terminé — ${pendingTest.destination}`);
        } catch (err) {
          log("ERROR", `Erreur test bot ${pendingTest.destination}: ${err}`);
        }
        continue;
      }
    } catch (err) {
      log("WARN", `Vérification pending tests échouée (non critique): ${err}`);
    }

    let jobs: HunterJob[];
    try {
      jobs = await getActiveJobs();
    } catch (err) {
      log("ERROR", `Échec récupération jobs: ${err} — retry dans 30s`);
      await new Promise((r) => setTimeout(r, 30_000));
      continue;
    }

    syncAdminResets(jobs);

    const due = findNextDueJob(jobs);

    if (!due) {
      const waitMs = getTimeUntilNextDue(jobs);
      const activeCount = jobs.filter((j) => !pausedJobs.has(j.id) && j.hunterConfig?.isActive).length;

      if (activeCount === 0) {
        log("INFO", "Aucun dossier actif — polling dans 90s");
      } else {
        const tierCounts = jobs
          .filter((j) => !pausedJobs.has(j.id) && j.hunterConfig?.isActive)
          .reduce<Record<string, number>>((acc, j) => {
            acc[j.urgencyTier] = (acc[j.urgencyTier] ?? 0) + 1;
            return acc;
          }, {});
        const tierStr = Object.entries(tierCounts).map(([t, n]) => `${n}×${t}`).join(", ");
        log("INFO", `Aucun dossier dû (${tierStr}) — prochain check dans ${formatMs(waitMs)}`);
      }

      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    const overdueMs = Date.now() - getNextCheckDue(due);
    const overdueStr = overdueMs > 0 ? ` (+${formatMs(overdueMs)} de retard)` : "";
    log("INFO", `▶ [${due.applicantName}] Check ${due.urgencyTier}${overdueStr}`);

    let result: SessionResult;
    try {
      result = await runHunterSession(due);
    } catch (err) {
      result = "error";
      log("ERROR", `[${due.applicantName}] Erreur session non capturée: ${err}`);
    }

    await handleResult(due, result);

    if (result !== "slot_found") {
      const silenceMs = getSilenceRadioMs();
      log("INFO", `📻 Silence radio ${formatMs(silenceMs)} (cooldown IP)...`);
      await new Promise((r) => setTimeout(r, silenceMs));
    }
  }
}

main().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});

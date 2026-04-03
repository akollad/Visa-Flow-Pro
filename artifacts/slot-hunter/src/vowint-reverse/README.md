# VOWINT Reverse Engineering — visaonweb.diplomatie.be

Reverse engineering du portail belge VOWINT (Visa On Web International) pour construction du bot CEV Kinshasa.
Capturé le 2026-04-03.

## Stack technique identifiée

| Composant | Valeur |
|---|---|
| Frontend | AngularJS (app module: `osOnline`) |
| Backend | ASP.NET MVC |
| Serveur | 193.191.208.217 (gouvernement belge) |
| Protection | F5 BIG-IP (cookie `TS0110ceb4`) — PAS de Cloudflare |
| Session | `ASP.NET_SessionId` + `OSOnline` |
| CSRF | `__RequestVerificationToken` (cookie + champ caché) |

## Endpoints confirmés

```
GET  /fr/VisaApplication/Create                    → créer nouvelle demande → AppId
GET  /common/getVisaApplication?AppId={uuid}       → lire état du formulaire
POST /fr/VisaApplication/Edit/{uuid}               → sauvegarder données demandeur
POST /Common/SetSessionVariable                    → session serveur (menu, etc.) — ignoré
GET  /VisaApplication/PrintGdpr?gdprApproval=1     → GDPR court séjour
GET  /VisaApplication/PrintGdpr?gdprApproval=2     → GDPR long séjour
```

## Headers obligatoires pour le bot

```http
X-Requested-With: XMLHttpRequest
If-Modified-Since: 0
Cookie: ASP.NET_SessionId=...; __RequestVerificationToken=...; TS0110ceb4=...; OSOnline=...
```

## Identifiants clés d'une demande

```
AppId   → UUID (ex: e978b2fd-472f-f111-a3ae-00505691de06) — utilisé dans toutes les URLs
VOWId   → Référence humaine (ex: VOWINT5903406) — sur lettre de convocation
VacId   → 1 = "VOW Internet" (notre mode)
```

## Flux bot (2 étapes)

```
ÉTAPE 1 — VOWINT
  1. GET /fr/VisaApplication/Create → cookies + AppId
  2. POST /fr/VisaApplication/Edit/{AppId} → données demandeur
  3. GET /common/getVisaApplication?AppId={uuid}
     → vérifier canTakeAppointment = true
     → extraire CompanyList[0].AppointmentUrl → lien CEV

ÉTAPE 2 — CEV Calendar (cev-kin.eu / schengenhouse.eu)
  4. GET {AppointmentUrl} → calendrier CEV
  5. POLL toutes les 5 min → scraper créneaux libres
  6. Créneau trouvé → POST confirmation → extraire référence
```

## ⚠️ Obstacles détectés (mis à jour 2026-04-03)

| Obstacle | Impact | Solution |
|---|---|---|
| **hCaptcha** sur `/fr/VisaApplication/Gdpr` | Bloque la création HTTP pure | Playwright + service anticaptcha (2captcha / capsolver) |
| **Script bot-detection** (`__scdn__done`) | Fingerprinting navigateur | Playwright avec stealth plugin (`playwright-extra`) |
| **Session F5 BIG-IP** (`TS0110ceb4`) | Sticky session, doit être conservée | Ne jamais réinitialiser les cookies en cours de session |

## Flux bot CORRIGÉ (3 étapes — après analyse HTML page)

```
ÉTAPE 0 — Création demande VOWINT (Playwright obligatoire à cause hCaptcha)
  1. GET  /fr/VisaApplication/Gdpr    → page GDPR consent + hCaptcha
  2. Résoudre hCaptcha (2captcha / capsolver ~0.003$)
  3. POST GDPR accept                 → redirect → /fr/VisaApplication/Edit/{AppId}
  4. Extraire AppId depuis l'URL de redirection → stocker dans Convex

ÉTAPE 1 — Remplissage VOWINT (HTTP pur suffisant après AppId obtenu)
  5. GET  /common/getVisaApplication?AppId={uuid}
  6. POST /fr/VisaApplication/Edit/{AppId} → sauvegarder données demandeur
  7. Re-GET /common/getVisaApplication → canTakeAppointment = true
     → extraire CompanyList[0].AppointmentUrl → stocker dans Convex

ÉTAPE 2 — CEV Calendar (cev-kin.eu / schengenhouse.eu)
  8. GET {AppointmentUrl} → calendrier CEV
  9. POLL toutes les 5 min → détecter créneaux libres
  10. Créneau trouvé → réserver → stocker référence RDV dans Convex
```

### Stratégie optimale
**Étapes 0-1 : une seule fois par client** (Playwright, ~30 secondes).
Stocker `AppId` + `AppointmentUrl` dans Convex (table `applications`).
**Étape 2 : polling léger en boucle** — HTTP pur, pas de Playwright, très rapide.

### Rôles compte VOWINT nécessaires
```
Applications_CanTakeAppointment       ← CRITIQUE pour accéder au calendrier CEV
Applications_CanCreateNewApplicationVOW
Applications_CanClickSubmit
Applications_CanViewMyList
```

## Champs formulaire VOWINT (données demandeur)

| Champ API | Description | Valeur type (DRC) |
|---|---|---|
| `Personal_Data_LastName` | Nom de famille | — |
| `Personal_Data_FirstName` | Prénom | — |
| `Personal_Data_BirthDate` | Date naissance | DD/MM/YYYY |
| `Personal_Data_NationalityId` | Nationalité | **58** = CONGO (Rep Dem) |
| `Personal_Data_GenderId` | Genre | 1=Masc, 2=Fém |
| `Personal_Data_Email` | Email | — |
| `Personal_Data_Mobilenumber` | Mobile | — |
| `TravelDocument_DocumentNumber` | N° passeport | — |
| `TravelDocument_ValidUntil` | Expiration passeport | — |
| `TravelDocument_DocumentTypeId` | Type doc | 1=Ordinaire |
| `Application_MemberStateOfDestinationId` | Pays destination | 32=BE, 86=FR... |
| `Application_VisaTypeRequestedId` | Type visa | 2=C (court séjour) |
| `Application_IntendedDateOfArrival` | Date d'arrivée prévue | — |
| `Application_DurationOfIntendedStay` | Durée séjour (jours) | — |
| `IsTravellerGroupQuestion` | Groupe? | 0=?, 1=Non, 2=Oui |
| `Application_GdprApproval` | GDPR accepté | 1 |

## ACTOR types (pour membres du groupe)

```javascript
TYPES:    { APPLICANT: 1, GUARDIAN: 2, OCCUPATION: 3, ACCOMODATION: 4, REFERENCEPERSON: 5 }
SUBTYPES: { VISAAPPLICANT: 1, PARENTALAUTHORITY: 2, LEGALGUARDIAN: 3, OCCUPATIONEMPLOYER: 4 }
```

## Fichiers capturés

| Fichier | Contenu |
|---|---|
| `app.js` | Bootstrap AngularJS, config $http, directives, constantes ACTOR |
| `commonController.js` | Contrôleur commun, baseUrl, endpoints menu/GDPR |
| *(à venir)* | `visaApplicationController.js` — logique formulaire principal |
| *(à venir)* | `appointmentController.js` — logique calendrier CEV |

## Pays Schengen couverts par le CEV Kinshasa (VacTypes)

Allemagne, Autriche, Belgique, Estonie, Finlande, France, Grèce, Hongrie, Italie,
Lettonie, Lituanie, Luxembourg, Pays-Bas, Portugal, République tchèque, Slovaquie, Slovénie

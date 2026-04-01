#!/usr/bin/env bash
# ============================================================
# check-portal-bundle.sh
# Vérifie si la clé AES du portail USA a changé depuis la
# dernière extraction. À exécuter avant chaque déploiement
# ou en cas d'échecs de login inexpliqués.
#
# Usage : bash check-portal-bundle.sh
# ============================================================

set -euo pipefail

PORTAL_BASE="https://www.usvisaappt.com"
PORTAL_APP_PATH="/visaapplicantui"
CURRENT_KEY="OuoCdl8xQh/OX6LbmgLEtZxZrvnOmrubsMhPW1VPRjk="
KEY_IN_CODE="$(grep -o 'USA_ENC_SEC_KEY = "[^"]*"' src/usaPortal.ts | grep -o '"[^"]*"' | tr -d '"')"

UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║        Vérification bundle portail USA               ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── 1. Trouver le nom actuel du bundle (hash content-based) ─────────────────
echo "▶ Étape 1/4 : Récupération du nom du bundle Angular..."
BUNDLE_NAME=$(curl -s "${PORTAL_BASE}${PORTAL_APP_PATH}/" \
  -H "User-Agent: ${UA}" \
  -H "Accept: text/html,application/xhtml+xml" \
  -L | grep -oE 'src="main\.[a-f0-9]+\.js"' | grep -oE 'main\.[a-f0-9]+\.js' | head -1)

if [ -z "$BUNDLE_NAME" ]; then
  echo "  ✗ Impossible de trouver le bundle. Le portail a peut-être changé de structure."
  exit 1
fi
echo "  ✓ Bundle actuel : ${BUNDLE_NAME}"

# ── 2. Télécharger le bundle ──────────────────────────────────────────────────
echo ""
echo "▶ Étape 2/4 : Téléchargement du bundle..."
TMP_BUNDLE=$(mktemp /tmp/portal_bundle_XXXXXX.js)
curl -s "${PORTAL_BASE}${PORTAL_APP_PATH}/${BUNDLE_NAME}" \
  -H "User-Agent: ${UA}" \
  -H "Referer: ${PORTAL_BASE}${PORTAL_APP_PATH}/login" \
  -L -o "$TMP_BUNDLE"
SIZE_KB=$(du -k "$TMP_BUNDLE" | cut -f1)
echo "  ✓ Téléchargé : ${SIZE_KB}KB → ${TMP_BUNDLE}"

# ── 3. Extraire la clé AES (base64 44 chars adjacente à PBKDF2/AES) ─────────
echo ""
echo "▶ Étape 3/4 : Extraction de la clé AES..."

# La clé est une chaîne base64 de 44 caractères contenant "/", "+", "=" 
# Le bundle contient toujours la clé comme une string littérale JS 
# à proximité des tokens "PBKDF2" ou "encSecKey"
EXTRACTED_KEY=$(grep -oP '(?<=")[A-Za-z0-9+/]{43}="' "$TMP_BUNDLE" | while read -r candidate; do
  # Vérifier que c'est bien adjacent à du contexte crypto (dans les 200 chars autour)
  if grep -qP "PBKDF2.{0,500}${candidate}|${candidate}.{0,500}PBKDF2" "$TMP_BUNDLE" 2>/dev/null; then
    echo "$candidate"
    break
  fi
done)

# Fallback: chercher la clé actuelle directement
if [ -z "$EXTRACTED_KEY" ]; then
  if grep -q "$CURRENT_KEY" "$TMP_BUNDLE"; then
    EXTRACTED_KEY="$CURRENT_KEY"
    echo "  ✓ Clé actuelle confirmée par recherche directe"
  else
    echo "  ⚠ Impossible d'extraire automatiquement la clé."
    echo ""
    echo "  Extraction manuelle — cherche une chaîne base64 de 44 chars"
    echo "  à proximité de 'PBKDF2' ou 'encSecKey' dans le bundle :"
    echo "  grep -oP '[A-Za-z0-9+/]{43}=' ${TMP_BUNDLE} | head -20"
    echo ""
    echo "  Ouvre le bundle dans VS Code :"
    echo "  code ${TMP_BUNDLE}"
    rm -f "$TMP_BUNDLE"
    exit 2
  fi
fi

echo "  ✓ Clé extraite : ${EXTRACTED_KEY}"

# ── 4. Comparer avec la clé en code ──────────────────────────────────────────
echo ""
echo "▶ Étape 4/4 : Comparaison..."
echo ""
echo "  Clé en code (usaPortal.ts) : ${KEY_IN_CODE}"
echo "  Clé dans le bundle actuel  : ${EXTRACTED_KEY}"
echo ""

if [ "$EXTRACTED_KEY" = "$KEY_IN_CODE" ]; then
  echo "  ✅ CLÉ INCHANGÉE — le robot est conforme au portail actuel."
  echo "     Bundle : ${BUNDLE_NAME}"
else
  echo "  🔴 CLÉ CHANGÉE — MISE À JOUR REQUISE !"
  echo ""
  echo "  ┌─────────────────────────────────────────────────────────────────┐"
  echo "  │  Ancienne clé : ${KEY_IN_CODE}  │"
  echo "  │  Nouvelle clé : ${EXTRACTED_KEY}  │"
  echo "  └─────────────────────────────────────────────────────────────────┘"
  echo ""
  echo "  ACTION : Remplace USA_ENC_SEC_KEY dans src/usaPortal.ts :"
  echo ""
  echo "  sed -i 's|${KEY_IN_CODE}|${EXTRACTED_KEY}|g' src/usaPortal.ts"
  echo ""
  echo "  Puis rebuild et redéploie le container Docker."
fi

# Vérification bonus : endpoints critiques toujours présents
echo ""
echo "▶ Bonus : Vérification endpoints critiques..."
ENDPOINTS=(
  "modifyslot/getFirstAvailableMonth"
  "modifyslot/getSlotDates"
  "modifyslot/getSlotTime"
  "appointmentrequest/getallbyuser"
  "appointments/schedule"
  "getUserHistoryApplicantPaymentStatus"
  "identity/user"
)

ALL_OK=true
for ep in "${ENDPOINTS[@]}"; do
  if grep -q "$ep" "$TMP_BUNDLE"; then
    echo "  ✓ ${ep}"
  else
    echo "  ✗ MANQUANT : ${ep}  ← endpoint supprimé ou renommé !"
    ALL_OK=false
  fi
done

rm -f "$TMP_BUNDLE"

echo ""
if $ALL_OK; then
  echo "  ✅ Tous les endpoints sont présents dans le bundle."
else
  echo "  🔴 Des endpoints sont manquants — inspect le bundle manuellement."
fi

echo ""
echo "══════════════════════════════════════════════════════"

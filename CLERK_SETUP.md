# Configuration Clerk + Convex pour Joventy

Ce guide explique comment configurer l'authentification Clerk et la base de données temps réel Convex pour Joventy.

---

## 1. Configuration Clerk

### 1.1 Méthodes d'authentification

Dans le [tableau de bord Clerk](https://dashboard.clerk.com), configurez les méthodes suivantes :

| Méthode | Comment activer |
|---------|----------------|
| Email + Mot de passe | Activé par défaut |
| Numéro de téléphone (SMS OTP) | User & Authentication → Phone number |
| Google OAuth | User & Authentication → Social Connections → Google |
| Apple OAuth | User & Authentication → Social Connections → Apple |
| Facebook OAuth | User & Authentication → Social Connections → Facebook |

### 1.2 URL de redirection autorisées

Dans **Clerk Dashboard → Domains & URLs**, ajoutez :
- URL de redirection après connexion : `/dashboard`
- URL de redirection après inscription : `/dashboard`
- URL de callback OAuth : `/sso-callback`

### 1.3 Créer un JWT Template "convex"

Pour que Convex puisse vérifier les tokens Clerk et connaître le rôle de l'utilisateur :

1. Allez dans **Clerk Dashboard → JWT Templates**
2. Cliquez **New template**
3. Nommez-le exactement `convex`
4. Dans le champ Claims (JSON), entrez :
```json
{
  "role": "{{user.public_metadata.role}}"
}
```
5. Sauvegardez

> **Pourquoi ?** Convex vérifie ce token pour connaître le rôle de chaque utilisateur (admin vs client).

---

## 2. Configurer les rôles Admin

### 2.1 Promouvoir un administrateur

Les administrateurs sont identifiés par leur `publicMetadata.role` dans Clerk :

1. Allez dans **Clerk Dashboard → Users**
2. Cliquez sur l'utilisateur à promouvoir
3. Dans **Metadata**, section **Public**, ajoutez :
```json
{
  "role": "admin"
}
```
4. Sauvegardez

> L'utilisateur doit se reconnecter pour que le changement prenne effet.

### 2.2 Comment ça marche

- Lors de la connexion, Clerk génère un JWT avec le claim `role`
- Convex lit ce claim dans chaque fonction backend pour autoriser ou refuser les opérations
- Le frontend vérifie `clerkUser.publicMetadata.role === "admin"` pour afficher l'espace admin

---

## 3. Variables d'environnement

| Variable | Description |
|----------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clé publique Clerk (commence par `pk_`) |
| `VITE_CONVEX_URL` | URL du déploiement Convex actuel |
| `CONVEX_DEPLOY_KEY` | Clé de déploiement Convex (pour CI/CD) |

---

## 4. Déploiement Convex

Pour déployer les fonctions backend Convex, exécutez :

```bash
CONVEX_DEPLOY_KEY=$CONVEX_DEPLOY_KEY npx convex deploy --yes --preview-create=joventy-dev
```

Après chaque déploiement, vérifiez que `VITE_CONVEX_URL` correspond à l'URL affichée.

---

## 5. Vérification de la configuration

Après toute modification, vérifiez :
- [ ] La connexion email fonctionne
- [ ] Les OAuth (Google, Apple, Facebook) redirigent correctement
- [ ] La connexion par téléphone (SMS) fonctionne
- [ ] Un admin voit l'espace `/admin`
- [ ] Un client voit uniquement l'espace `/dashboard`
- [ ] Les données se synchronisent en temps réel (chat, statut des dossiers)

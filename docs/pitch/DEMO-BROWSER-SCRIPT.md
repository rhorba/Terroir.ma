# Terroir.ma — Script de Démo Live (Navigateur)

### Présentation de fin de pitch · Walkthrough complet · Avril 2026

> **Usage :** Ce script est conçu pour une démonstration en direct dans un navigateur web.
> Chaque étape indique l'URL exacte, les champs à remplir, et le bouton à cliquer.
> Aucune commande curl ou JSON n'est nécessaire.

---

## Ports de l'application

| Service          | URL de base             |
| ---------------- | ----------------------- |
| Portail (portal) | `http://localhost:3001` |
| Vérification QR  | `http://localhost:3002` |
| API backend      | `http://localhost:3000` |
| Keycloak         | `http://localhost:8080` |

---

## Personnages

| Persona       | Rôle                   | Identifiants Keycloak   |
| ------------- | ---------------------- | ----------------------- |
| **Khalid**    | `super-admin`          | `khalid` / `Test1234!`  |
| **Fatima**    | `cooperative-admin`    | `fatima` / `Test1234!`  |
| **Hassan**    | `cooperative-member`   | `hassan` / `Test1234!`  |
| **Dr. Amina** | `lab-technician`       | `amina` / `Test1234!`   |
| **Youssef**   | `inspector`            | `youssef` / `Test1234!` |
| **Omar**      | `certification-body`   | `omar` / `Test1234!`    |
| **Leila**     | `customs-agent`        | `leila` / `Test1234!`   |
| **Yuki**      | consumer (sans compte) | aucun — accès public    |

---

## Checklist avant la démo (5 min)

Avant de monter sur scène, vérifier que tout fonctionne :

- [ ] `docker compose --profile full up -d` — stack complète démarrée
- [ ] Ouvrir `http://localhost:3000/health` → doit afficher `{ "status": "ok" }`
- [ ] Ouvrir `http://localhost:3001/fr/login` → page de login visible
- [ ] Avoir 7 onglets navigateur pré-ouverts, un par persona (voir ordre ci-dessous)

---

## Narration en une phrase

> _Une coopérative de safran à Taliouine obtient une certification IGP sous la loi marocaine 25-06,
> et un acheteur à Paris la vérifie — sans passer un seul appel téléphonique — en moins de 2 secondes._

---

## ACT 1 — Khalid enregistre et valide la coopérative (super-admin)

**Durée estimée : 2 min**

---

### Étape 1.1 — Connexion en tant que Khalid

1. Ouvrir un onglet et naviguer vers :
   ```
   http://localhost:3001/fr/login
   ```
2. Vous voyez une page blanche centrée avec le titre **"Terroir.ma"** et un bouton vert.
3. Cliquer sur le bouton **"Se connecter"** (ou "Login").
4. Keycloak s'ouvre. Remplir :
   - **Username :** `khalid`
   - **Password :** `Test1234!`
5. Cliquer **"Sign In"**.
6. Vous êtes redirigé vers `http://localhost:3001/fr/super-admin` — le tableau de bord administrateur.

---

### Étape 1.2 — Consulter la liste des coopératives

1. Dans la barre de navigation, cliquer sur **"Coopératives"**.
   → URL : `http://localhost:3001/fr/super-admin/cooperatives`
2. La liste des coopératives en attente de vérification s'affiche.
3. Cliquer sur le nom **"Coopérative Safran Taliouine"** (ou la première de la liste).
   → URL : `http://localhost:3001/fr/super-admin/cooperatives/{id}`

---

### Étape 1.3 — Vérifier la coopérative

1. Sur la page de détail de la coopérative, faire défiler jusqu'au bouton vert **"Vérifier"**.
2. Cliquer **"Vérifier"**.
3. Une boîte de dialogue apparaît : **"Confirmer la vérification de cette coopérative ?"**
4. Cliquer **"OK"**.
5. Le statut de la coopérative passe à **"active"** (badge vert visible sur la page).

> **Message clé pour l'audience :** _"Khalid vient de valider la coopérative en un clic — sans paperasse, avec horodatage immuable dans la blockchain d'audit."_

---

### Étape 1.4 — Enregistrer un laboratoire accrédité ONSSA

1. Dans la barre de navigation, cliquer sur **"Laboratoires"**.
   → URL : `http://localhost:3001/fr/super-admin/labs`
2. Cliquer le bouton **"+ Nouveau laboratoire"**.
   → URL : `http://localhost:3001/fr/super-admin/labs/new`
3. Remplir le formulaire :
   - **Nom \*** : `Laboratoire ONSSA Agadir`
   - **N° Accréditation ONSSA** : `ONSSA-2026-001`
4. Cliquer **"Enregistrer"**.
5. Vous êtes redirigé vers la liste des labos avec le nouveau laboratoire visible.

---

## ACT 2 — Fatima configure sa coopérative (cooperative-admin)

**Durée estimée : 2 min**

---

### Étape 2.1 — Connexion en tant que Fatima

1. Ouvrir un **nouvel onglet** et naviguer vers :
   ```
   http://localhost:3001/fr/login
   ```
2. Cliquer **"Se connecter"**, puis dans Keycloak :
   - **Username :** `fatima`
   - **Password :** `Test1234!`
3. Vous arrivez sur `http://localhost:3001/fr/cooperative-admin` — le tableau de bord de la coopérative.

---

### Étape 2.2 — Ajouter un membre (Hassan)

1. Dans le menu de gauche, cliquer sur **"Membres"**.
   → URL : `http://localhost:3001/fr/cooperative-admin/members`
2. Cliquer **"+ Ajouter un membre"**.
   → URL : `http://localhost:3001/fr/cooperative-admin/members/new`
3. Remplir le formulaire :
   - **Nom complet (fr) \*** : `Hassan Oubella`
   - **الاسم الكامل (ar)** : `حسن أوبيلة` _(optionnel)_
   - **CIN \*** : `J123456`
   - **Téléphone \*** : `+212662345678`
   - **Email** : `hassan@coop-safran.ma` _(optionnel)_
   - **Rôle** : sélectionner `member` dans la liste déroulante
4. Cliquer **"Ajouter le membre"**.
5. Retour automatique vers la liste des membres avec Hassan visible.

---

### Étape 2.3 — Enregistrer une ferme GPS

1. Dans le menu, cliquer sur **"Fermes"**.
   → URL : `http://localhost:3001/fr/cooperative-admin/farms`
2. Cliquer **"+ Enregistrer une ferme"**.
   → URL : `http://localhost:3001/fr/cooperative-admin/farms/new`
3. Remplir le formulaire :
   - **Nom de la ferme \*** : `Parcelle Nord Taliouine — Lot 3`
   - **Région \*** : sélectionner `Drâa-Tafilalet` dans la liste déroulante
   - **Commune** : `Taliouine`
   - **Surface (hectares) \*** : `2.5`
   - **Cultures** : `SAFFRON`
   - **Latitude** : `30.532100`
   - **Longitude** : `-7.924100`
4. Cliquer **"Enregistrer la ferme"**.
5. Retour vers la liste des fermes.

> **Message clé :** _"La parcelle est géolocalisée avec PostGIS — sa position GPS est immuable dans le certificat."_

---

## ACT 3 — Hassan enregistre la récolte et crée un lot (cooperative-member)

**Durée estimée : 2 min**

---

### Étape 3.1 — Connexion en tant que Hassan

1. Ouvrir un **nouvel onglet** → `http://localhost:3001/fr/login`
2. Cliquer **"Se connecter"**, puis :
   - **Username :** `hassan`
   - **Password :** `Test1234!`
3. Vous arrivez sur `http://localhost:3001/fr/cooperative-member`.

---

### Étape 3.2 — Enregistrer une récolte

1. Dans le menu, cliquer sur **"Récoltes"**.
   → URL : `http://localhost:3001/fr/cooperative-member/harvests`
2. Cliquer **"+ Enregistrer une récolte"**.
   → URL : `http://localhost:3001/fr/cooperative-member/harvests/new`
3. Remplir le formulaire :
   - **Ferme \*** : sélectionner `Parcelle Nord Taliouine — Lot 3 (DRA)` dans la liste
   - **Type de produit \*** : sélectionner `Safran (SAFFRON)` dans la liste
   - **Quantité (kg) \*** : `1250.5`
   - **Date de récolte \*** : sélectionner `28/10/2025` via le sélecteur de date
   - **Année de campagne \*** : `2025/2026`
   - **Méthode de récolte \*** : `Cueillette manuelle des pistils`
4. Cliquer **"🌿 Enregistrer la récolte"**.
5. Retour vers la liste des récoltes avec la nouvelle récolte visible.

---

### Étape 3.3 — Créer un lot de production

1. Dans le menu, cliquer sur **"Lots"**.
   → URL : `http://localhost:3001/fr/cooperative-member/batches`
2. Cliquer **"+ Créer un lot"**.
   → URL : `http://localhost:3001/fr/cooperative-member/batches/new`
3. Remplir le formulaire :
   - **Type de produit \*** : sélectionner `Safran (SAFFRON)`
   - **Récoltes à inclure \*** : cocher la récolte `SAFFRON — 1250.50 kg · 2025-10-28`
   - **Quantité totale (kg) \*** : se remplit automatiquement à `1250.50`
   - **Date de traitement \*** : sélectionner `29/10/2025`
4. Cliquer **"📦 Créer le lot"**.
5. Retour vers la liste des lots.

> **Message clé :** _"Toute la chaîne d'approvisionnement est traçable — de la parcelle au lot, en passant par la date de cueillette."_

---

## ACT 4 — Dr. Amina saisit les résultats du laboratoire (lab-technician)

**Durée estimée : 1.5 min**

---

### Étape 4.1 — Connexion en tant que Dr. Amina

1. Ouvrir un **nouvel onglet** → `http://localhost:3001/fr/login`
2. Cliquer **"Se connecter"**, puis :
   - **Username :** `amina`
   - **Password :** `Test1234!`
3. Vous arrivez sur `http://localhost:3001/fr/lab-technician`.

---

### Étape 4.2 — Consulter la file d'attente

1. Dans le menu, cliquer sur **"File d'analyse"**.
   → URL : `http://localhost:3001/fr/lab-technician/queue`
2. Le lot `SAFFRON — 1250.50 kg` apparaît dans la liste avec le statut `submitted`.
3. Cliquer sur le lot pour voir ses détails.
   → URL : `http://localhost:3001/fr/lab-technician/queue/{id}`

---

### Étape 4.3 — Saisir les résultats ISO 3632

1. Sur la page du test, faire défiler jusqu'au formulaire **"Saisir les résultats"**.
2. Remplir les paramètres d'analyse du safran (norme ISO 3632) :
   - **crocin_e440 (absorbance)** : `247`
   - **safranal_e330 (absorbance)** : `34`
   - **picrocrocin_e257 (absorbance)** : `82`
   - **moisture_pct (%)** : `8.5`
   - **ash_total_pct (%)** : `5.2`
   - **Nom du technicien** : `Dr. Amina Benali`
   - **Nom du laboratoire** : `Laboratoire ONSSA Agadir`
3. Cliquer **"Enregistrer les résultats"**.
4. Retour vers la file d'attente avec le statut mis à jour.

> **Message clé :** _"Les paramètres ISO 3632 sont intégrés dans la plateforme — le laboratoire entre des chiffres, le système valide automatiquement les seuils."_

---

## ACT 5 — Youssef inspecte et dépose son rapport (inspector)

**Durée estimée : 1.5 min**

---

### Étape 5.1 — Connexion en tant que Youssef

1. Ouvrir un **nouvel onglet** → `http://localhost:3001/fr/login`
2. Cliquer **"Se connecter"**, puis :
   - **Username :** `youssef`
   - **Password :** `Test1234!`
3. Vous arrivez sur `http://localhost:3001/fr/inspector`.

---

### Étape 5.2 — Consulter les inspections assignées

1. Dans le menu, cliquer sur **"Inspections"**.
   → URL : `http://localhost:3001/fr/inspector/inspections`
2. L'inspection du lot safran de la coopérative Taliouine est listée.
3. Cliquer sur l'inspection pour l'ouvrir.
   → URL : `http://localhost:3001/fr/inspector/inspections/{id}`

---

### Étape 5.3 — Déposer le rapport d'inspection

1. Faire défiler jusqu'au formulaire **"Déposer le rapport"**.
2. Remplir le formulaire :
   - **Résultat \*** : cliquer sur le bouton radio **✅ Conforme**
   - **Résumé du rapport \*** :
     ```
     Inspection terrain réalisée le 05/11/2025. Parcelle conforme aux exigences de l'IGP Safran de Taliouine. Conditions de stockage satisfaisantes.
     ```
   - **Observations détaillées** _(optionnel)_ :
     ```
     Altitude vérifiée : 1650m. Méthode de cueillette manuelle validée. Aucune trace de pesticides détectée.
     ```
   - **Non-conformités** : laisser vide
3. Cliquer **"Soumettre le rapport"**.
4. Retour vers la liste des inspections, statut **"rapport déposé"**.

---

## ACT 6 — Omar accorde la certification IGP (certification-body)

**Durée estimée : 1.5 min**

---

### Étape 6.1 — Connexion en tant que Omar

1. Ouvrir un **nouvel onglet** → `http://localhost:3001/fr/login`
2. Cliquer **"Se connecter"**, puis :
   - **Username :** `omar`
   - **Password :** `Test1234!`
3. Vous arrivez sur `http://localhost:3001/fr/certification-body`.

---

### Étape 6.2 — Examiner la demande de certification

1. Dans le menu, cliquer sur **"Certifications"**.
   → URL : `http://localhost:3001/fr/certification-body/certifications`
2. La demande de la coopérative Taliouine apparaît avec le statut `PENDING` ou `INSPECTION_PASSED`.
3. Cliquer sur la demande.
   → URL : `http://localhost:3001/fr/certification-body/certifications/{id}`
4. La page affiche : numéro de lot, résultats du labo (247 absorbance crocine), rapport d'inspection (Conforme).

---

### Étape 6.3 — Accorder la certification IGP

1. Faire défiler jusqu'au bloc vert **"Accorder la certification"**.
2. Remplir :
   - **Valide du \*** : sélectionner `01/11/2025`
   - **Valide jusqu'au \*** : sélectionner `31/10/2026`
3. Cliquer **"✅ Accorder la certification"**.
4. Retour vers la liste. Statut désormais **GRANTED** avec le numéro :
   ```
   TERROIR-IGP-DRAA_TAFILALET-2025-0001
   ```

> **Message clé :** _"Omar vient d'émettre un certificat conforme à la loi 25-06. Il est immédiatement accessible en ligne et vérifiable par QR code."_

---

## ACT 7 — Leila génère et valide le document d'export (customs-agent)

**Durée estimée : 1.5 min**

---

### Étape 7.1 — Connexion en tant que Leila

1. Ouvrir un **nouvel onglet** → `http://localhost:3001/fr/login`
2. Cliquer **"Se connecter"**, puis :
   - **Username :** `leila`
   - **Password :** `Test1234!`
3. Vous arrivez sur `http://localhost:3001/fr/customs-agent`.

---

### Étape 7.2 — Générer un document d'export

1. Dans le menu, cliquer sur **"Documents d'export"**.
   → URL : `http://localhost:3001/fr/customs-agent/export-documents`
2. Cliquer **"+ Générer un document"**.
   → URL : `http://localhost:3001/fr/customs-agent/export-documents/new`
3. Remplir le formulaire (copier l'ID de certification depuis l'ACT 6) :
   - **ID Certification** : _(coller l'UUID de la certification accordée par Omar)_
   - **Pays destination (ISO 2)** : `DE`
   - **Code HS** : `09102000`
   - **Quantité (kg)** : `500`
   - **Nom consignataire** : `Gewürzhaus GmbH`
   - **Pays consignataire (ISO 2)** : `DE`
4. Cliquer **"Générer le document"**.
5. Le message **"Document généré avec succès"** apparaît avec un lien **"Voir le document →"**.
6. Cliquer le lien.
   → URL : `http://localhost:3001/fr/customs-agent/export-documents/{id}`

---

### Étape 7.3 — Valider le dédouanement

1. Sur la page du document, faire défiler jusqu'au bloc vert **"Valider le dédouanement"**.
2. Lire le texte : _"Approuver ce document confirme la clearance douanière pour l'exportation."_
3. Cliquer **"Valider le dédouanement"**.
4. Le statut du document passe à **"approved"**.

> **Message clé :** _"Le document d'export est validé en ligne — plus besoin d'envoyer du papier au port de Casablanca."_

---

## ACT 8 — Yuki scanne le QR code depuis Paris (consumer — sans compte)

**Durée estimée : 45 secondes**

---

### Étape 8.1 — Accès public sans connexion

1. Ouvrir un **nouvel onglet** ou utiliser un **téléphone mobile**.
2. Scanner le QR code sur l'emballage du safran certifié
   **OU** naviguer directement vers (remplacer `{uuid}` par l'UUID de la certification) :
   ```
   http://localhost:3002/fr/verify/{uuid}
   ```
3. La page de vérification s'affiche **instantanément** (aucune connexion requise) avec :
   - Badge vert **"GRANTED"**
   - **Numéro de certification :** `TERROIR-IGP-DRAA_TAFILALET-2025-0001`
   - **Coopérative :** `Coopérative Safran Taliouine`
   - **Type de produit :** `SAFFRON`
   - **Type de certification :** `IGP`
   - **Région :** `DRAA_TAFILALET`
   - **Valide du :** `2025-11-01`
   - **Valide jusqu'au :** `2026-10-31`

> **Message clé pour l'audience :** _"Yuki est à Paris. En moins de 2 secondes, elle a la confirmation que le safran est certifié IGP, sans appeler ni le producteur, ni le ministère. C'est ça, la traçabilité numérique."_

---

## Résumé de la chaîne complète

```
Khalid (super-admin)
  → Vérifie la coopérative ✅

Fatima (cooperative-admin)
  → Ajoute Hassan comme membre ✅
  → Enregistre la parcelle GPS ✅

Hassan (cooperative-member)
  → Enregistre 1 250 kg de récolte ✅
  → Crée un lot de production ✅

Dr. Amina (lab-technician)
  → Saisit les résultats ISO 3632 ✅

Youssef (inspector)
  → Dépose le rapport d'inspection (Conforme) ✅

Omar (certification-body)
  → Accorde la certification IGP ✅
  → Numéro : TERROIR-IGP-DRAA_TAFILALET-2025-0001

Leila (customs-agent)
  → Génère et valide le document d'export vers l'Allemagne ✅

Yuki (consumer — Paris)
  → Scanne le QR → vérification en < 2 secondes ✅
```

**Durée totale de la démo :** ~ 12 minutes

---

## En cas de problème pendant la démo

| Problème                            | Solution rapide                                                              |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| La page de login ne s'ouvre pas     | Vérifier que `docker compose --profile full up -d` est bien lancé            |
| "Unauthorized" après la connexion   | L'utilisateur n'existe pas dans Keycloak — relancer `npm run keycloak:setup` |
| Le formulaire refuse la soumission  | Vérifier les champs marqués `*` et le format (ex: `2025/2026` pour l'année)  |
| Le QR code renvoie "non trouvé"     | Utiliser l'UUID exact de la certification accordée par Omar (ACT 6)          |
| Le document d'export ne se crée pas | La certification doit être au statut `GRANTED` — vérifier l'ACT 6            |

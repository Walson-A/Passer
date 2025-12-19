# Checklist V1 Deploy-Ready - Passer

## 🔴 Critique (Bloquant pour déploiement)

### Build & Packaging
- [ ] **Build de production fonctionne** : `npm run tauri build` sans erreurs
- [ ] **Installeur généré** : MSI/NSIS pour Windows fonctionnel
- [ ] **Icônes présentes** : Toutes les tailles d'icônes configurées
- [ ] **Métadonnées correctes** : Nom, version, auteur dans `Cargo.toml` et `tauri.conf.json`
- [ ] **Version cohérente** : Même version partout (0.1.0 → passer à 1.0.0 ?)

### Fonctionnalités Core
- [ ] **Push/Pull fonctionne** : Transferts texte, images, fichiers testés
- [ ] **Serveur démarre** : Port 8000 accessible, mDNS fonctionne
- [ ] **Presse-papiers** : Copie/colle fonctionne correctement
- [ ] **Sauvegarde fichiers** : Fichiers bien sauvegardés dans `Passboard`
- [ ] **Tray icon** : Minimisation et restauration fonctionnelles
- [ ] **Auto-start** : Démarrage automatique configuré

### Gestion d'Erreurs
- [ ] **Port occupé** : Message d'erreur clair si port 8000 indisponible
- [ ] **Permissions** : Gestion des erreurs d'écriture (disque plein, permissions)
- [ ] **Collisions fichiers** : Gestion des fichiers en double (renommer ou écraser ?)
- [ ] **Réseau** : Gestion si pas d'IP locale disponible
- [ ] **Crash handling** : L'app ne plante pas silencieusement

### Documentation
- [ ] **README utilisateur** : Instructions d'installation et d'utilisation
- [ ] **README développeur** : Instructions de build et développement
- [ ] **Changelog** : Notes de version pour la v1.0.0

---

## 🟡 Important (Recommandé pour v1)

### UX/UI
- [ ] **Feedback visuel** : Animations de transfert claires
- [ ] **Messages d'erreur** : Messages compréhensibles pour l'utilisateur
- [ ] **États de l'app** : Indicateurs visuels clairs (on/off, transfert en cours)
- [ ] **Responsive** : UI s'adapte aux différentes tailles d'écran

### Robustesse
- [ ] **Gestion mémoire** : Pas de fuites mémoire évidentes
- [ ] **Concurrence** : Gestion correcte des transferts simultanés
- [ ] **Nettoyage** : Fermeture propre des ressources (serveur, fichiers temporaires)
- [ ] **Logs** : Logs utiles pour le débogage (mais pas trop verbeux en prod)

### Configuration
- [ ] **Chemins configurables** : Dossier `Passboard` configurable (optionnel pour v1)
- [ ] **Port configurable** : Port 8000 configurable si occupé (optionnel pour v1)

---

## 🟢 Nice-to-have (Peut attendre v1.1+)

- [ ] **Historique long terme** : Persistance entre sessions (déjà décidé : plus tard)
- [ ] **Statistiques** : Compteurs de transferts
- [ ] **Recherche** : Recherche dans l'historique
- [ ] **Export** : Export de l'historique
- [ ] **Thèmes** : Personnalisation de l'UI
- [ ] **Notifications** : Notifications système pour transferts

---

## 🔍 Points d'Attention Identifiés

### 1. Gestion des Collisions de Fichiers
**Problème actuel** : `std::fs::write` écrase les fichiers existants sans avertissement.

**Options** :
- **Option A (Simple)** : Écraser silencieusement (comportement actuel)
- **Option B (Recommandé)** : Renommer avec suffixe `(1)`, `(2)`, etc.
- **Option C** : Demander confirmation (trop complexe pour v1)

**Recommandation** : Option B - Renommer automatiquement pour éviter perte de données.

### 2. README Utilisateur
Le README actuel est juste le template Tauri. Il faut :
- Instructions d'installation
- Guide d'utilisation basique
- Dépannage (troubleshooting)
- Capture d'écran (optionnel mais utile)

### 3. Gestion Port Occupé
Si le port 8000 est occupé, l'app doit :
- Afficher un message d'erreur clair
- Suggérer de fermer l'autre application
- Ou proposer un port alternatif (v1.1+)

### 4. Métadonnées de Build
- `authors = ["you"]` → Remplacer par votre nom/email
- `productName = "passer-app"` → Peut-être "Passer" tout court ?
- Version : 0.1.0 → 1.0.0 pour première release ?

---

## 📋 Tests à Effectuer Avant Release

### Tests Fonctionnels
- [ ] Transfert texte iPhone → PC
- [ ] Transfert texte PC → iPhone
- [ ] Transfert image iPhone → PC
- [ ] Transfert image PC → iPhone
- [ ] Transfert fichier iPhone → PC
- [ ] Transfert multiple fichiers
- [ ] Archive ZIP (pull)
- [ ] mDNS résolution (`passer.local`)
- [ ] Tray icon (minimize/restore)
- [ ] Auto-start au démarrage

### Tests de Robustesse
- [ ] Port 8000 occupé
- [ ] Disque plein
- [ ] Pas de permissions d'écriture
- [ ] Pas de connexion réseau
- [ ] Fichier très volumineux (> 100 MB)
- [ ] Nom de fichier avec caractères spéciaux
- [ ] Fermeture brutale de l'app

### Tests de Build
- [ ] Build debug fonctionne
- [ ] Build release fonctionne
- [ ] Installeur MSI généré
- [ ] Installeur NSIS généré
- [ ] Installation propre sur machine vierge
- [ ] Désinstallation propre
- [ ] Mise à jour depuis version précédente (si applicable)

---

## 🚀 Prochaines Étapes Recommandées

1. **Priorité 1** : Gestion des collisions de fichiers (renommage automatique)
2. **Priorité 2** : README utilisateur complet
3. **Priorité 3** : Gestion d'erreur port occupé
4. **Priorité 4** : Tests fonctionnels complets
5. **Priorité 5** : Build de production et test d'installation

---

## 💡 Questions à Résoudre

1. **Version de release** : 0.1.0 ou 1.0.0 pour première release publique ?
2. **Nom du produit** : "passer-app" ou "Passer" ?
3. **Collisions fichiers** : Écraser ou renommer automatiquement ?
4. **Port alternatif** : Implémenter en v1 ou v1.1 ?
5. **Logs en production** : Niveau de verbosité souhaité ?

---

*Dernière mise à jour : Analyse initiale pour v1 deploy-ready*


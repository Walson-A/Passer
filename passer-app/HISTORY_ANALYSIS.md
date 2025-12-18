# Analyse : Système d'Historique Long Terme pour Passer

## 1. Analyse de l'Application

### Contexte Actuel
- **Type d'application** : Transfert de fichiers local entre iPhone et PC Windows
- **Types de transferts** :
  - **Texte** : Presse-papiers (push/pull)
  - **Images** : PNG, JPG, HEIC (push/pull)
  - **Fichiers** : Tous types (push uniquement)
  - **Archives ZIP** : Fichiers multiples (pull uniquement)
- **Direction** : 
  - **Incoming** : iPhone → PC (fichiers sauvegardés dans `Passboard`)
  - **Outgoing** : PC → iPhone (contenu du presse-papiers Windows)
- **Stockage actuel** : Historique en mémoire uniquement (limité à 50 items, perdu au redémarrage)
- **Métadonnées disponibles** :
  - Type de contenu (text/image/file/archive)
  - Direction (incoming/outgoing)
  - Nom de fichier
  - Taille (bytes)
  - Chemin complet (pour fichiers incoming)
  - Timestamp
  - Statut (pending/success/error)

### Architecture Technique
- **Backend** : Rust (Tauri 2.0) avec Axum
- **Frontend** : React + TypeScript
- **Communication** : Événements Tauri (actuellement parsing fragile de logs)
- **Stockage fichiers** : `C:\Users\...\Desktop\Passer\Passboard\`

---

## 2. Besoins Probables des Utilisateurs

### Besoins Essentiels (P0)
1. **Consultation récente** : Voir les 10-20 derniers transferts
2. **Accès rapide** : Ouvrir un fichier depuis l'historique
3. **Information de base** : Nom, type, date, direction, statut

### Besoins Importants (P1)
4. **Recherche** : Trouver un transfert par nom de fichier
5. **Filtrage** : Par type (image/video/text), direction, date
6. **Persistance** : Historique conservé entre les sessions
7. **Statistiques basiques** : Nombre de transferts, volume total

### Besoins Secondaires (P2)
8. **Historique étendu** : Plus de 50 items (100-1000+)
9. **Export** : Exporter l'historique en JSON/CSV
10. **Nettoyage automatique** : Suppression automatique après X jours
11. **Statistiques avancées** : Graphiques, tendances
12. **Favoris** : Marquer des transferts importants

### Cas d'Usage Typiques
- **Cas 1** : "Où est le fichier que j'ai reçu hier ?"
- **Cas 2** : "Combien de photos ai-je transférées cette semaine ?"
- **Cas 3** : "Quel était le dernier texte que j'ai envoyé à mon iPhone ?"
- **Cas 4** : "Pourquoi ce transfert a échoué ?" (debug)

---

## 3. Capacité Probable

### Estimation de Volume

**Par entrée d'historique** :
```rust
struct HistoryEntry {
    id: String,              // ~36 bytes (UUID)
    type: String,            // ~10 bytes
    direction: String,       // ~10 bytes
    name: String,            // ~50-200 bytes (nom de fichier)
    description: String,     // ~20 bytes
    status: String,          // ~10 bytes
    timestamp: i64,          // 8 bytes
    raw_path: Option<String>, // ~100-300 bytes (chemin Windows)
    size_bytes: Option<u64>, // 8 bytes
}
// Total estimé : ~250-600 bytes par entrée
```

**Scénarios d'utilisation** :

| Profil Utilisateur | Transferts/jour | Entrées/mois | Taille DB/mois | Entrées/an | Taille DB/an |
|-------------------|-----------------|--------------|----------------|------------|--------------|
| **Léger** | 2-5 | 60-150 | ~30-90 KB | 720-1800 | ~360 KB - 1 MB |
| **Moyen** | 10-20 | 300-600 | ~150-360 KB | 3600-7200 | ~1.8-4.3 MB |
| **Intensif** | 50-100 | 1500-3000 | ~750 KB - 1.8 MB | 18000-36000 | ~9-22 MB |
| **Professionnel** | 200+ | 6000+ | ~3 MB+ | 72000+ | ~36 MB+ |

### Durée de Rétention Probable
- **Minimum** : 30 jours (1 mois)
- **Typique** : 90-180 jours (3-6 mois)
- **Maximum** : 365 jours (1 an) ou illimité

### Contraintes
- **Espace disque** : Négligeable (< 50 MB même pour usage intensif)
- **Mémoire** : Chargement progressif recommandé (pagination)
- **Performance** : Requêtes < 100ms pour 10K entrées

---

## 4. Options Techniques Disponibles

### Option 1 : SQLite (Recommandé ⭐)

**Description** : Base de données relationnelle embarquée, fichier unique

**Avantages** :
- ✅ **Performances** : Requêtes SQL rapides, indexation native
- ✅ **Robustesse** : ACID, gestion des transactions
- ✅ **Évolutivité** : Supporte facilement 100K+ entrées
- ✅ **Requêtes complexes** : JOIN, GROUP BY, filtres avancés
- ✅ **Mature** : Bibliothèque Rust stable (`rusqlite` ou `sqlx`)
- ✅ **Taille** : Fichier unique, facile à sauvegarder/migrer
- ✅ **Standard** : Format universel, outils tiers disponibles

**Inconvénients** :
- ❌ **Dépendance** : Ajoute une crate Rust (~500 KB binaire)
- ❌ **Complexité** : Nécessite schéma de base de données
- ❌ **Migration** : Gestion des versions de schéma

**Implémentation** :
```rust
// Crate recommandée : rusqlite avec feature "bundled"
dependencies = { rusqlite = { version = "0.31", features = ["bundled"] } }
```

**Taille estimée** : ~500 KB (binaire) + ~1-50 MB (base de données selon usage)

---

### Option 2 : Fichier JSON

**Description** : Stockage sérialisé dans un fichier JSON

**Avantages** :
- ✅ **Simplicité** : Aucune dépendance supplémentaire
- ✅ **Lisible** : Format texte, débogage facile
- ✅ **Portable** : Facile à exporter/partager
- ✅ **Rapide à implémenter** : Utilise `serde_json` déjà présent

**Inconvénients** :
- ❌ **Performance** : Chargement complet en mémoire, pas d'indexation
- ❌ **Évolutivité** : Lent avec > 10K entrées
- ❌ **Intégrité** : Pas de transactions, risque de corruption
- ❌ **Recherche** : Linéaire O(n), pas de filtres efficaces
- ❌ **Concurrence** : Difficile à gérer avec écritures simultanées

**Implémentation** :
```rust
// Utilise serde_json déjà dans Cargo.toml
// Fichier : ~/.passer/history.json
```

**Taille estimée** : ~0 KB (dépendances) + ~1-50 MB (fichier JSON)

---

### Option 3 : IndexedDB (via Tauri Store Plugin)

**Description** : Base de données NoSQL côté frontend (navigateur)

**Avantages** :
- ✅ **Asynchrone** : API native async/await
- ✅ **Indexation** : Index sur champs clés
- ✅ **Quotas** : Gestion automatique de l'espace
- ✅ **Intégration frontend** : Logique côté React

**Inconvénients** :
- ❌ **Frontend uniquement** : Pas d'accès direct depuis Rust
- ❌ **Complexité** : Nécessite plugin Tauri supplémentaire
- ❌ **Limitations** : Moins puissant que SQLite pour requêtes complexes
- ❌ **Dépendance** : Plugin externe à maintenir

**Implémentation** :
```bash
# Plugin Tauri Store
tauri-plugin-store = "2"
```

**Taille estimée** : ~100 KB (plugin) + ~1-50 MB (base IndexedDB)

---

### Option 4 : Fichier Binaire Custom (MessagePack/BSON)

**Description** : Format binaire sérialisé, plus compact que JSON

**Avantages** :
- ✅ **Compact** : ~30% plus petit que JSON
- ✅ **Performance** : Désérialisation plus rapide
- ✅ **Simplicité** : Similaire à JSON en usage

**Inconvénients** :
- ❌ **Même problème que JSON** : Pas d'indexation, chargement complet
- ❌ **Moins lisible** : Format binaire, débogage difficile
- ❌ **Dépendance** : Crate supplémentaire (`rmp-serde` ou `bson`)

**Implémentation** :
```rust
dependencies = { rmp-serde = "1.1" } // MessagePack
```

**Taille estimée** : ~50 KB (crate) + ~0.7-35 MB (fichier binaire)

---

### Option 5 : Hybrid (SQLite + Cache JSON)

**Description** : SQLite pour persistance, JSON pour cache rapide

**Avantages** :
- ✅ **Meilleur des deux mondes** : Performance + simplicité
- ✅ **Flexibilité** : Cache pour accès fréquents

**Inconvénients** :
- ❌ **Complexité** : Gestion de deux systèmes
- ❌ **Synchronisation** : Risque de désynchronisation

---

## 5. Comparaison Détaillée

| Critère | SQLite | JSON | IndexedDB | MessagePack | Hybrid |
|---------|--------|------|-----------|-------------|--------|
| **Performance (10K entrées)** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **Recherche/Filtrage** | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐ |
| **Simplicité implémentation** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| **Évolutivité** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **Taille binaire** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Maintenance** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| **Robustesse** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **Débogage** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |

---

## 6. Recommandation

### 🏆 Choix Recommandé : **SQLite avec `rusqlite`**

### Justification

1. **Besoins utilisateurs** : Recherche et filtrage nécessitent une vraie base de données
2. **Évolutivité** : L'application peut grandir, SQLite suit
3. **Performance** : Requêtes < 10ms même avec 100K entrées
4. **Robustesse** : ACID garantit l'intégrité des données
5. **Standard** : Format universel, outils disponibles (DB Browser, etc.)
6. **Coût acceptable** : +500 KB binaire, négligeable pour une app desktop

### Architecture Proposée

```
src-tauri/src/
├── history/
│   ├── mod.rs           // Module principal
│   ├── database.rs      // Gestion SQLite
│   ├── models.rs        // Structures de données
│   └── migrations.rs    // Gestion des versions
```

**Schéma de base de données** :
```sql
CREATE TABLE history_entries (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,           -- 'image' | 'video' | 'text' | 'archive' | 'file'
    direction TEXT NOT NULL,      -- 'incoming' | 'outgoing'
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL,         -- 'pending' | 'success' | 'error'
    timestamp INTEGER NOT NULL,   -- Unix timestamp
    raw_path TEXT,                -- Chemin complet (nullable)
    size_bytes INTEGER,           -- Taille en bytes (nullable)
    error_message TEXT,           -- Message d'erreur si status='error'
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_timestamp ON history_entries(timestamp DESC);
CREATE INDEX idx_type ON history_entries(type);
CREATE INDEX idx_direction ON history_entries(direction);
CREATE INDEX idx_name ON history_entries(name);
```

### Plan de Migration

1. **Phase 1** : Implémentation SQLite de base (CRUD)
2. **Phase 2** : Migration depuis historique en mémoire
3. **Phase 3** : Ajout de recherche/filtrage
4. **Phase 4** : Nettoyage automatique (optionnel)
5. **Phase 5** : Export/Import (optionnel)

### Alternatives selon Contraintes

- **Si taille binaire critique** : JSON (mais limiter à 1000 entrées max)
- **Si logique frontend préférée** : IndexedDB
- **Si simplicité absolue** : JSON avec pagination manuelle

---

## 7. Métriques de Succès

- ✅ Historique persiste entre sessions
- ✅ Recherche < 100ms pour 10K entrées
- ✅ Affichage des 20 derniers items < 50ms
- ✅ Taille base de données < 50 MB après 1 an d'usage intensif
- ✅ Pas de perte de données lors de crash

---

## Conclusion

**SQLite** est le choix optimal pour un système d'historique long terme dans Passer. Il offre le meilleur équilibre entre performance, fonctionnalités et maintenabilité, tout en restant léger et adapté à une application desktop.

**Prochaines étapes** : Implémentation du module SQLite avec schéma de base de données et API Rust pour le frontend.


# ws-serv-specs — Référence des endpoints

> **Base URL :** `http://localhost:3014/api`  
> **Auth :** Tous les endpoints (sauf `/healthz`) requièrent le header `x-api-key`.  
> **Port :** `3014`

---

## Sommaire

1. [Health](#1-health)
2. [Templates](#2-templates)
3. [Specifications](#3-specifications)
4. [AI (Anthropic SDK)](#4-ai-anthropic-sdk)

---

## 1. Health

| Méthode | Route       | Auth      | Description                  |
|---------|-------------|-----------|------------------------------|
| `GET`   | `/healthz`  | Non       | Vérifie l'état du service    |

### `GET /healthz`

- **Auth :** aucune (throttle désactivé)
- **Query params :** aucun
- **Réponse 200 :**
  ```json
  {
    "status": "ok",
    "timestamp": "2026-04-13T10:00:00.000Z",
    "uptime": 3600.5
  }
  ```

---

## 2. Templates

Gestion des modèles de spécification (structure hiérarchique : Template → Chapitres → Sous-chapitres L1 → Sous-chapitres L2).

| Méthode  | Route                                                                          | Auth      | Body DTO                  | Description                              |
|----------|--------------------------------------------------------------------------------|-----------|---------------------------|------------------------------------------|
| `GET`    | `/templates`                                                                   | x-api-key | —                         | Lister tous les modèles actifs           |
| `GET`    | `/templates/:wid`                                                              | x-api-key | —                         | Récupérer un modèle avec sa hiérarchie   |
| `POST`   | `/templates`                                                                   | x-api-key | `CreateTemplateDto`       | Créer un nouveau modèle                  |
| `PATCH`  | `/templates/:wid`                                                              | x-api-key | `UpdateTemplateDto`       | Mettre à jour un modèle                  |
| `DELETE` | `/templates/:wid`                                                              | x-api-key | —                         | Supprimer un modèle (soft delete)        |
| `POST`   | `/templates/:wid/chapters`                                                     | x-api-key | `CreateChapterDto`        | Ajouter un chapitre à un modèle          |
| `PATCH`  | `/templates/:wid/chapters/:chapterWid`                                         | x-api-key | `UpdateChapterDto`        | Mettre à jour un chapitre                |
| `DELETE` | `/templates/:wid/chapters/:chapterWid`                                         | x-api-key | —                         | Supprimer un chapitre                    |
| `PUT`    | `/templates/:wid/chapters/reorder`                                             | x-api-key | `ReorderChaptersDto`      | Réordonner les chapitres d'un modèle     |
| `POST`   | `/templates/:wid/chapters/:chapterWid/subchapters`                             | x-api-key | `CreateSubChapterL1Dto`   | Ajouter un sous-chapitre L1              |
| `PATCH`  | `/templates/:wid/chapters/:chapterWid/subchapters/:scWid`                      | x-api-key | `UpdateSubChapterL1Dto`   | Mettre à jour un sous-chapitre L1        |
| `DELETE` | `/templates/:wid/chapters/:chapterWid/subchapters/:scWid`                      | x-api-key | —                         | Supprimer un sous-chapitre L1            |
| `POST`   | `/templates/:wid/chapters/:chapterWid/subchapters/:scWid/subchapters`          | x-api-key | `CreateSubChapterL2Dto`   | Ajouter un sous-chapitre L2              |
| `PATCH`  | `/templates/:wid/chapters/:chapterWid/subchapters/:scWid/subchapters/:sc2Wid`  | x-api-key | `UpdateSubChapterL2Dto`   | Mettre à jour un sous-chapitre L2        |
| `DELETE` | `/templates/:wid/chapters/:chapterWid/subchapters/:scWid/subchapters/:sc2Wid`  | x-api-key | —                         | Supprimer un sous-chapitre L2            |

---

### DTOs — Templates

#### `CreateTemplateDto`
| Champ             | Type     | Requis | Contraintes      | Description                               |
|-------------------|----------|--------|------------------|-------------------------------------------|
| `title`           | `string` | Oui    | maxLength: 100   | Titre du modèle                           |
| `userDescription` | `string` | Non    | —                | Description affichée aux utilisateurs     |
| `docDescription`  | `string` | Non    | —                | Description intégrée dans le document     |
| `megaPrompt`      | `string` | Non    | —                | Mega-prompt global associé au modèle      |
| `createdBy`       | `string` | Non    | —                | Identifiant du créateur                   |

#### `UpdateTemplateDto`
| Champ             | Type     | Requis | Contraintes      | Description                               |
|-------------------|----------|--------|------------------|-------------------------------------------|
| `title`           | `string` | Non    | maxLength: 100   | Nouveau titre                             |
| `userDescription` | `string` | Non    | —                | Description affichée aux utilisateurs     |
| `docDescription`  | `string` | Non    | —                | Description intégrée dans le document     |
| `megaPrompt`      | `string` | Non    | —                | Mega-prompt global                        |

#### `CreateChapterDto`
| Champ             | Type      | Requis | Contraintes    | Description                           |
|-------------------|-----------|--------|----------------|---------------------------------------|
| `title`           | `string`  | Oui    | maxLength: 40  | Titre du chapitre                     |
| `prompt`          | `string`  | Oui    | —              | Prompt IA associé au chapitre         |
| `userDescription` | `string`  | Non    | —              | Description affichée aux utilisateurs |
| `docDescription`  | `string`  | Non    | —              | Description intégrée dans le document |
| `isVariable`      | `boolean` | Non    | default: false | Chapitre à contenu variable           |

#### `UpdateChapterDto`
| Champ             | Type      | Requis | Contraintes    | Description                           |
|-------------------|-----------|--------|----------------|---------------------------------------|
| `title`           | `string`  | Non    | maxLength: 40  | Nouveau titre                         |
| `prompt`          | `string`  | Non    | —              | Prompt IA associé                     |
| `userDescription` | `string`  | Non    | —              | Description affichée aux utilisateurs |
| `docDescription`  | `string`  | Non    | —              | Description intégrée dans le document |
| `isVariable`      | `boolean` | Non    | —              | Chapitre à contenu variable           |

#### `ReorderChaptersDto`
| Champ   | Type                               | Requis | Description                                      |
|---------|------------------------------------|--------|--------------------------------------------------|
| `items` | `Array<{ wid: string, order: number }>` | Oui | Liste des chapitres avec leur nouvel ordre  |

#### `CreateSubChapterL1Dto`
| Champ        | Type      | Requis | Contraintes    | Description                        |
|--------------|-----------|--------|----------------|------------------------------------|
| `title`      | `string`  | Oui    | —              | Titre du sous-chapitre L1          |
| `isVariable` | `boolean` | Non    | default: false | Sous-chapitre à contenu variable   |

#### `UpdateSubChapterL1Dto`
| Champ        | Type      | Requis | Description                        |
|--------------|-----------|--------|------------------------------------|
| `title`      | `string`  | Non    | Nouveau titre                      |
| `isVariable` | `boolean` | Non    | Sous-chapitre à contenu variable   |

#### `CreateSubChapterL2Dto`
| Champ   | Type     | Requis | Contraintes   | Description               |
|---------|----------|--------|---------------|---------------------------|
| `title` | `string` | Oui    | maxLength: 25 | Titre du sous-chapitre L2 |

#### `UpdateSubChapterL2Dto`
| Champ   | Type     | Requis | Contraintes   | Description               |
|---------|----------|--------|---------------|---------------------------|
| `title` | `string` | Non    | maxLength: 25 | Nouveau titre             |

---

## 3. Specifications

Gestion des instances de spécification (éditeur). Une spécification est créée depuis un template et contient le contenu rédigé.

| Méthode  | Route                                                        | Auth      | Body / Query DTO               | Réponse         | Description                              |
|----------|--------------------------------------------------------------|-----------|--------------------------------|-----------------|------------------------------------------|
| `GET`    | `/specifications`                                            | x-api-key | Query: `QuerySpecificationsDto`| `200` liste     | Lister les spécifications                |
| `GET`    | `/specifications/:wid`                                       | x-api-key | —                              | `200` / `404`   | Récupérer une spécification              |
| `POST`   | `/specifications`                                            | x-api-key | `CreateSpecificationDto`       | `201` / `404`   | Créer une spécification depuis un template |
| `PATCH`  | `/specifications/:wid`                                       | x-api-key | `UpdateSpecificationDto`       | `200` / `404`   | Mettre à jour une spécification          |
| `DELETE` | `/specifications/:wid`                                       | x-api-key | —                              | `200` / `404`   | Supprimer une spécification (soft delete)|
| `GET`    | `/specifications/:wid/chapters/:chapterWid`                  | x-api-key | —                              | `200` / `404`   | Récupérer le contenu d'un chapitre       |
| `PATCH`  | `/specifications/:wid/chapters/:chapterWid`                  | x-api-key | `UpdateChapterContentDto`      | `200` / `404`   | Mettre à jour le contenu d'un chapitre   |
| `POST`   | `/specifications/:wid/chapters/subchapters`                  | x-api-key | `CreateDynamicSubChapterDto`   | `201` / `404`   | Ajouter un sous-chapitre dynamique       |
| `DELETE` | `/specifications/:wid/chapters/:chapterWid/subchapters/:scWid` | x-api-key | —                            | `200` / `404`   | Supprimer un sous-chapitre dynamique     |
| `GET`    | `/specifications/:wid/export`                                | x-api-key | —                              | `text/markdown` | Exporter la spécification en Markdown    |
| `POST`   | `/specifications/:wid/save-version`                          | x-api-key | —                              | `201` / `404`   | Sauvegarder une version                  |

---

### DTOs — Specifications

#### `QuerySpecificationsDto` (query params)
| Paramètre   | Type     | Requis | Description                      |
|-------------|----------|--------|----------------------------------|
| `projectId` | `string` | Non    | Filtrer par identifiant de projet |
| `stepId`    | `string` | Non    | Filtrer par identifiant d'étape  |

#### `CreateSpecificationDto`
| Champ         | Type     | Requis | Description                               |
|---------------|----------|--------|-------------------------------------------|
| `templateWid` | `string` | Oui    | WID du template à utiliser                |
| `name`        | `string` | Oui    | Nom de la spécification                   |
| `createdBy`   | `string` | Oui    | Identifiant du créateur                   |
| `projectId`   | `string` | Non    | Identifiant du projet WakaProject         |
| `stepId`      | `string` | Non    | Identifiant de l'étape du projet          |
| `initialText` | `string` | Non    | Texte initial pour la ventilation IA      |

#### `UpdateSpecificationDto`
| Champ       | Type                  | Requis | Description                          |
|-------------|-----------------------|--------|--------------------------------------|
| `name`      | `string`              | Non    | Nouveau nom                          |
| `status`    | `SpecificationStatus` | Non    | Nouveau statut (enum Prisma)         |
| `updatedBy` | `string`              | Non    | Identifiant du modificateur          |

#### `UpdateChapterContentDto`
| Champ         | Type      | Requis | Contraintes  | Description                              |
|---------------|-----------|--------|--------------|------------------------------------------|
| `content`     | `string`  | Oui    | —            | Contenu Markdown du chapitre             |
| `progress`    | `number`  | Non    | 0–100        | Pourcentage de complétion                |
| `isAutoSaved` | `boolean` | Non    | default: true| Indique si c'est une sauvegarde auto     |

#### `CreateDynamicSubChapterDto`
| Champ        | Type     | Requis | Description                                      |
|--------------|----------|--------|--------------------------------------------------|
| `title`      | `string` | Oui    | Titre du sous-chapitre dynamique                 |
| `chapterWid` | `string` | Oui    | WID du chapitre parent auquel rattacher           |

---

## 4. AI (Anthropic SDK)

Endpoints de rédaction assistée par IA. Tous utilisent l'**Anthropic SDK** (`@anthropic-ai/sdk`) en backend.

| Méthode | Route                             | Auth      | Body DTO              | IA  | Description                                              |
|---------|-----------------------------------|-----------|-----------------------|-----|----------------------------------------------------------|
| `POST`  | `/ai/ventilate`                   | x-api-key | `VentilateDto`        | Oui | Ventiler un texte initial dans tous les chapitres        |
| `POST`  | `/ai/generate`                    | x-api-key | `GenerateChapterDto`  | Oui | Générer ou enrichir le contenu d'un chapitre             |
| `POST`  | `/ai/modify`                      | x-api-key | `ModifyContentDto`    | Oui | Modifier un texte sélectionné dans un chapitre           |
| `POST`  | `/ai/delete-content`              | x-api-key | `DeleteContentDto`    | Oui | Supprimer un texte sélectionné d'un chapitre             |
| `POST`  | `/ai/test-prompt`                 | x-api-key | `TestPromptDto`       | Oui | Tester un prompt sans créer de spécification (≤500 tokens) |
| `GET`   | `/ai/history/:specificationWid`   | x-api-key | —                     | Non | Récupérer l'historique IA d'une spécification            |

---

### DTOs — AI

#### `VentilateDto`
| Champ              | Type     | Requis | Description                                  |
|--------------------|----------|--------|----------------------------------------------|
| `specificationWid` | `string` | Oui    | WID de la spécification cible                |
| `initialText`      | `string` | Oui    | Texte initial à ventiler dans les chapitres  |
| `userId`           | `string` | Oui    | Identifiant de l'utilisateur                 |

#### `GenerateChapterDto`
| Champ              | Type     | Requis | Description                                    |
|--------------------|----------|--------|------------------------------------------------|
| `specificationWid` | `string` | Oui    | WID de la spécification                        |
| `chapterWid`       | `string` | Oui    | WID du chapitre à générer                      |
| `userId`           | `string` | Oui    | Identifiant de l'utilisateur                   |
| `userInstruction`  | `string` | Non    | Instruction pour guider la génération          |

#### `ModifyContentDto`
| Champ              | Type     | Requis | Description                                    |
|--------------------|----------|--------|------------------------------------------------|
| `specificationWid` | `string` | Oui    | WID de la spécification                        |
| `chapterWid`       | `string` | Oui    | WID du chapitre contenant le texte             |
| `selectedText`     | `string` | Oui    | Texte sélectionné par l'utilisateur à modifier |
| `userInstruction`  | `string` | Oui    | Instruction de modification                    |
| `userId`           | `string` | Oui    | Identifiant de l'utilisateur                   |

#### `DeleteContentDto`
| Champ              | Type     | Requis | Description                                  |
|--------------------|----------|--------|----------------------------------------------|
| `specificationWid` | `string` | Oui    | WID de la spécification                      |
| `chapterWid`       | `string` | Oui    | WID du chapitre contenant le texte           |
| `selectedText`     | `string` | Oui    | Texte sélectionné à supprimer                |
| `userId`           | `string` | Oui    | Identifiant de l'utilisateur                 |

#### `TestPromptDto`
| Champ           | Type     | Requis | Description                                              |
|-----------------|----------|--------|----------------------------------------------------------|
| `megaPrompt`    | `string` | Oui    | Le mega-prompt (system prompt) du template               |
| `chapterPrompt` | `string` | Oui    | Le prompt du chapitre à tester                           |
| `sampleInput`   | `string` | Non    | Texte d'entrée exemple pour simuler du contenu utilisateur |

---

## Notes

- **Tables Prisma :** `waka_spec_template*`, `waka_specification`, `waka_spec_chapter_content`, `waka_spec_ai_history`
- **Base de données :** PostgreSQL dédiée `specs` (séparée de `ws-serv-config`)
- **BFF proxy :** Le BFF route `/api/proxy/specs/*` vers ce service
- **Versioning :** `POST /specifications/:wid/save-version` crée un snapshot avec numéro de version et export Markdown
- **Export :** `GET /specifications/:wid/export` retourne `Content-Type: text/markdown`
- **Historique IA :** Chaque interaction IA est tracée dans `waka_spec_ai_history`

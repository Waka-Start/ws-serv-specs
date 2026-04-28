# Documentation Wakastart — référentiel local

Ce dossier rassemble la connaissance Wakastart de référence pour le module `ws-serv-specs`.
Les fichiers ci-dessous sont des **exports Markdown figés** depuis Google Drive — la source de vérité reste le Google Doc d'origine.

Ces fichiers sont auto-chargés par Claude Code via les `@`-références présentes dans `ws-serv-specs/CLAUDE.md`.

## Index des documents

| Fichier | Sujet | Source Google Doc | Dernière MAJ source |
| --- | --- | --- | --- |
| [`descriptif-plateforme-wakastart.md`](./descriptif-plateforme-wakastart.md) | Vue d'ensemble de la plateforme WakaStart 2026 — vocabulaire, technologies, packs d'hébergement, certifications | [Projet WakaStart](https://docs.google.com/document/d/1dYsO5qtCE3PAtDVqKa9Sx-9sVW_AurhlgG2hVgHjNKs/edit) | 2026-02-09 (Florelle SCHIRRA) |
| [`methodologie-waka-creation-pack.md`](./methodologie-waka-creation-pack.md) | Méthodologie Waka Creation Pack — étapes et fichiers (PROJECT, AF, SCR, AT, WAKA, PRD) du besoin au déploiement | [Méthodologie IA Projet Startups](https://docs.google.com/document/d/1qGDeAE9LcMbc3wsYEziXDYHdQAHdhhXL7Qcz7iFViYI/edit) | 2026-04-28 (Theo Neron) |
| [`referentiel-pratiques-waka.md`](./referentiel-pratiques-waka.md) | Référentiel interne des bonnes pratiques Waka (WIP) — répartition des contributions par expert | [Référentiel pratiques WAKA](https://docs.google.com/document/d/1RFt4LNrkcZJikG1bB5pWroa6j7yuFZ4CypqGknasjnc/edit) | 2026-04-15 (Thomas Pelletier) |
| [`wakaproject-module.md`](./wakaproject-module.md) | Module WakaProject — gestion de projet intégrée, rattachement organisation, droits, création | [WakaProject](https://docs.google.com/document/d/1iCjyb4lwpWCKlbQy2emYOl9F45JJQcTvyfbzEgP4YVI/edit) | 2026-04-19 (Denis SCHIRRA) |

## Procédure de resync

Lorsqu'un Google Doc est mis à jour côté Drive :

1. Récupérer l'ID Drive depuis l'URL (segment entre `/d/` et `/edit`).
2. Lire le contenu via le MCP Google Docs : `mcp__google-docs__readDocument` avec `format: "markdown"`.
3. Écraser le fichier `.md` correspondant dans ce dossier.
4. Mettre à jour la colonne *Dernière MAJ source* du tableau ci-dessus.
5. Si le titre Google Doc a changé, conserver le nom de fichier kebab-case existant pour ne pas casser les `@`-références dans `CLAUDE.md`.

## Convention

- Slug : kebab-case basé sur le titre du Google Doc.
- En-tête HTML obligatoire en haut de chaque `.md` : URL source, ID Drive, date d'export, dernier modificateur connu.
- Aucune édition manuelle du contenu : la source de vérité est le Google Doc.

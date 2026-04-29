<!--
Source : https://docs.google.com/document/d/1qGDeAE9LcMbc3wsYEziXDYHdQAHdhhXL7Qcz7iFViYI/edit
Titre original : Méthodologie IA Projet Startups
Document Drive ID : 1qGDeAE9LcMbc3wsYEziXDYHdQAHdhhXL7Qcz7iFViYI
Date d'export : 2026-04-28
Dernière modification connue : 2026-04-28 par Theo Neron
-->

# Méthodologie Waka Creation Pack

Mise en œuvre des Waka Creation Pack avec les différentes étapes et les prompts nécessaires aux IA.

Ce document vise à construire la méthodologie pour pouvoir accompagner une start-up entre son expression de besoins et la création de son APP SaaS en ligne.

## Dénomination des fichiers Waka

Ce document fait référence à plusieurs documents d'analyse avec la dénomination suivante :

- **PROJECT-`<nom-du-projet>`.gdoc — Le document Projet** : envoyé au préalable au porteur de projet afin que celui-ci puisse remplir et compléter les différentes sections souhaitées.
- **AF-`<nom-du-projet>`.md — L'Analyse Fonctionnelle** : issue de l'interview du porteur de projet, compréhensible pour le porteur de projet et une personne avec un profil non technique. Doit être validée par le porteur de projet avant de passer à l'étape suivante.
- **SCR-`<nom-du-module>`.md — Les Spécifications d'écran** : issues de Mowgli, propres à chaque module important du projet.
- **AT-`<nom-du-projet>`.md — L'Analyse Technique** : découle de l'analyse fonctionnelle et de l'ensemble des spécifications d'écran. Document technique pour un humain destiné à être validé par le chef de projet WakaStart.
- **WAKA-`<nom-du-projet>`.json — Le paramétrage de la WakaApp** : comprend tous les éléments techniques de paramétrage à importer dans l'interface d'administration WakaStart afin de créer la WakaApp avec ses features, profils, droits et tous les éléments descriptifs associés.
- **PRD-`<nom-du-projet>`.md — Le Plan de Codage pour Claude Code** : découle de tous les éléments précédents et regroupe dans un même document toutes les spécifications nécessaires au codage et aux tests de l'application.

## La méthodologie Waka Startup Creation Pack

### Étape 1 — Documentation préalable

#### Envoi du questionnaire de base au porteur de projet

Afin de simplifier la collecte des données et l'analyse fonctionnelle, un Google Doc partagé est envoyé au porteur de projet avant la phase d'analyse interactive dans Claude :

- Nom du projet
- Description du projet
- Rôles et Personas
- Éléments confidentiels, de sécurité ou réglementaires
- etc.

*Résultat* : fichier de description du projet `PROJECT-<nom-du-projet>.gdoc` initial.
*Durée* : 30 à 60 minutes.

### Étape 2 — Analyse en présence du Porteur de Projet

Cette demi-journée peut se réaliser en présentiel ou à distance par visioconférence.

#### Analyse fonctionnelle assistée par Claude

Un premier Mega-Prompt pour Claude Sonnet 4.6 permet d'interviewer le Porteur de Projet afin qu'il puisse décrire sa solution, ce qui aboutit à une Analyse Fonctionnelle détaillée (document non technique) à valider par le Porteur de Projet.

Pour les applications complexes, le projet et les designs d'écran peuvent être séparés en plusieurs tâches.

*Durée* : 30 à 60 minutes selon préparation.
*Résultat* : `AF-<nom-du-projet>.md` initial.

#### Transformation en Analyse Technique

Pour générer le fichier d'analyse technique, fournir à Claude :
- le document d'analyse fonctionnelle,
- l'ensemble des fichiers `SCR-<nom-du-module>.md`,
- les deux fichiers techniques propres à la gestion multi-tenant (`&SPECS-DROITS-ET-ROLES WakaStart.md`) et à l'intégration WakaStart (`&SPECS-INTEGRATION-WAKASTART.md`),

avec le prompt :

> Transforme le document d'analyse fonctionnelle et le(s) fichier(s) associé(s) `SCR-xxxxx.md` en une Analyse Technique nommée `AT-<nom-du-projet>.md`, liée à la technologie WakaStart grâce aux deux fichiers `&SPECS...` mis en pièces jointes, afin que l'on ait tous les éléments nécessaires à pouvoir développer l'application dans la foulée mais sans générer le moindre code pour l'instant. Il ne s'agit pas non plus de faire un PRD directement, ça sera la troisième étape. Pour l'instant, je veux juste une analyse technique lisible par un humain avec tous les éléments liés à WakaStart.

*Durée* : 5 à 15 min IA + 30 min relecture humaine.
*Résultat* : `AT-<nom-du-projet>.md`.

#### Création du JSON de paramétrage de la WakaApp

Dans la même discussion, ajouter le fichier `WAKA-modele.JSON` et demander à Claude :

> Complète le modèle JSON avec les éléments du projet et renomme le fichier en `WAKA-<nom-du-projet>.md` afin qu'il soit prêt à intégrer directement dans WakaStart.

*Durée* : 5 minutes (IA uniquement).
*Résultat* : `WAKA-<nom-du-projet>.json`.

Avec ce fichier, se connecter en tant que super admin dans WakaStart, créer le owner correspondant au porteur de projet, puis importer la première app avec tous les critères définis via le fichier JSON.

#### Création de l'APP dans WakaStart et du squelette dans GitHub

Un SuperAdmin WakaStart se connecte dans l'interface, crée le Porteur de Projet sous forme de Owner puis crée la WakaApp via l'import du fichier JSON.

L'interface WakaStart crée le nouveau projet au niveau de GitHub, importe le modèle de code source lié aux différents modules et interfaces utilisateur requis, et crée des scénarios de déploiement CI/CD pour le projet.

*Durée* : 5 à 10 minutes (humain).
*Résultat* : une WakaApp définie dans WakaStart et projet déployé dans GitHub.

#### Création du PRD de codage pour Claude Code

Dans la même discussion que les Spécifications Techniques, demander à Claude :

> Rédige le PRD technique au format markdown, nommé `PRD-<nom-du-projet>.md` et destiné à Claude Code pour qu'on puisse directement passer à la phase de codage incluant les différents modules nécessaire à développer l'application SaaS, dans le contexte spécifique de WakaStart.

*Durée* : 5 à 15 minutes (IA uniquement).
*Résultat* : `PRD-<nom-du-projet>.md`.

À ce niveau, on est prêt à coder et déployer ; on a consommé entre 1h30 et 3h avec le porteur de projet.

### Étape 3 — Codage de l'Application

Faire intervenir un WakaMaster certifié pour les technologies WakaStart, qui utilise Claude Code et le PRD du projet pour construire tout le code source TypeScript de manière itérative en quelques heures à quelques jours, et réaliser un premier déploiement dans l'environnement de Test WakaStart (accessible directement en ligne).

*Durée* : 1 à 50 heures (IA + développeur) selon complexité.
*Résultat* : projet codé et déployé sur l'environnement de Test.

### Étape 4 — Tests de l'Application

Le porteur de projet teste l'application et vérifie la cohérence entre l'Analyse Fonctionnelle issue de son expression de besoin et le résultat final à l'écran.

À ce niveau, on est prêt à tester l'application ; on a consommé entre 4 et 8 heures de temps avec le porteur de projet.

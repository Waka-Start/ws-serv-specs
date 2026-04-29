<!--
Source : https://docs.google.com/document/d/1dYsO5qtCE3PAtDVqKa9Sx-9sVW_AurhlgG2hVgHjNKs/edit
Titre original : Projet WakaStart
Document Drive ID : 1dYsO5qtCE3PAtDVqKa9Sx-9sVW_AurhlgG2hVgHjNKs
Date d'export : 2026-04-28
Dernière modification connue : 2026-02-09 par Florelle SCHIRRA
-->

# Descriptif de la plateforme WakaStart 2026

## Vocabulaire

- **WakaStart** : nom de la plateforme SaaS proposée par WakaStellar.
- **WakaStellar** : nom de l'éditeur propriétaire de la solution.
- **WakaSign, WakaSeal, WakaVoice, WakaHds** : logiciels indépendants de WakaStellar, intégrables sous forme d'API native dans WakaStart pour le développement des applications Partenaires.
- **WakaClub** : ensemble de Prestataires de Confiance certifiés Waka, sélectionnés pour leur relation avec WakaStart et leurs compétences (management, stratégie, sécurisation, cybersécurité, formation).
- **Partenaire** : éditeur SaaS, client de la plateforme WakaStart (StartUp, ScaleUp ou éditeur Legacy).
- **StartUp / ScaleUp / Legacy** : graphies à respecter (avec majuscules) lorsqu'on parle de l'éditeur partenaire.

## La plateforme WakaStart

WakaStart est une plateforme unique de développement, de déploiement et d'hébergement de solutions SaaS, incluant :

- des projets full web,
- des projets avec des apps iOS et Android,
- des projets avec des clients lourds Windows / macOS / Linux.

### La sécurité Cyber au centre des débats

Solution **Secure by Design** : meilleurs patterns de sécurité de l'analyse fonctionnelle au codage IA, au déploiement Kubernetes et à l'hébergement. Toutes les étapes respectent les standards Kubernetes sécurité afin d'obtenir une certification ISO 27001 associée à la solution logicielle incubée.

### Aptitude à la migration des développements historiques

Le **Waka Migration Pack** permet de migrer n'importe quel applicatif web SaaS existant (PHP, Python, Go, TypeScript) vers les technologies **Next.js** et **Nest.js**, incluant la sécurité et les fonctionnalités globales WakaStart. Traitement confié à une équipe spécifique (quelques jours à quelques semaines). En sortie : code neuf, totalement réécrit et sécurisé, compatible avec l'application actuelle, avec documentation, sécurité, jeux de test, évolutivité et scalabilité de production.

### Développements sur mesure 10 à 25× plus rapides

Coût divisé par 5 à 15 et temps de développement / time-to-market divisés par 10. Quelques semaines (au pire 1-2 mois) suffisent à développer une application complexe.

Au-delà du premier développement, un responsable de développement à temps plein annuel est mis à disposition pour le suivi.

### Traduction automatique dans toutes les langues

Implémentation native i18n : l'IA extrait tous les textes du code source et exploite des fichiers de traduction natifs séparés du code. Permet d'ajouter des langues ou de corriger des textes à chaud, sans redéployer.

Traduction confiée aux IA de dernière génération (analyse de tout le contexte, pas ligne à ligne). Thesaurus disponible pour la gestion des mots-clés multilingues.

### Gestion des marques blanches intégrée

Gestion visuelle native des thèmes, couleurs et marques blanches. Personnalisation à plusieurs niveaux :
- au niveau de l'application déclarée dans WakaStart,
- par Network (revendeur) : page d'accueil, login, aspect interne,
- par client final du revendeur (surcharge),
- par utilisateur (couleurs d'écran et de boutons).

Les développeurs n'ont rien à faire : tout est géré par la plateforme.

### Gestion multi-tenant native des WakaApp

Gestion multi-tenant native pour chaque app, qui permet de définir :
- des **applications**,
- des **réseaux de distribution** (chacun avec sa marque et son éditeur visuel),
- des **clients** rattachés aux réseaux (entités autonomes, avec leurs utilisateurs, équipes, groupes et teams),

en gérant l'intégralité des objets métiers et la sécurité jusqu'au niveau le plus fin des droits applicatifs.

### Le Waka Club : un écosystème de Partenaires

Au-delà de la solution applicative, WakaStart propose son **Waka Club** : un écosystème de partenaires fournissant les prestations complémentaires menant à une certification ISO 27001 (réglementation européenne, directive NIS2). Quasi obligatoire dans un développement SaaS B2B/B2C compte tenu du nombre de cyberattaques.

## Certifications ISO 27001, HDS et NIS2

WakaStart intègre dès le départ toutes les bonnes pratiques, outils de supervision, monitoring, traces et observabilité nécessaires à une certification ISO 27001.

### Gestion maîtrisée des coûts de certification

Les coûts viennent en complément de l'offre de base et dépendent de l'organisation du partenaire et de sa maturité cyber.

Force de WakaStart : solution tout-en-un (dev / déploiement / hébergement) respectant les meilleures pratiques cyber + écosystème Waka Club avec audits internes, RSSI et DPO à temps partagé, conseil en bonnes pratiques internes.

### Certification ISO 27001 en quelques mois

Délais d'obtention : **3 à 6 mois** selon le partenaire. Étape nécessaire pour répondre aux dossiers NIS2 (obligatoires à partir de l'automne 2026 pour travailler en B2B avec une entreprise essentielle en Europe).

## Les technologies de pointe WakaStart

Plateforme **mono-langage** : TypeScript, applications Front et Back en **Next.js** et **Nest.js**, conformément aux standards de l'industrie 2026.

### Ergonomie UI/UX prête à l'emploi avec Shad/cn

Librairie graphique **Waka-UI** : permet de créer instantanément une application complexe avec menus à plusieurs niveaux, header avec notifications, dark mode, menu avatar, barre de recherche rapide et boutons d'accès rapide. Uniformise les interfaces clients, applique les thèmes automatiquement, et garantit une UX de premier rang.

### IAM, Gestion des identités et SSO

Solution open source **Keycloak** intégrée nativement, paramétrée depuis les écrans applicatifs des gestionnaires métiers. Isolation forte entre applications via la notion de **Realm** et clés de signature distinctes par application.

Chaque WakaApp bénéficie d'une gestion complexe des droits utilisateurs regroupables dans des profils côté client final. Sécurisation des JWT par des fonctionnalités standards qui vérifient les droits à chaque appel API/back-office.

### Traçabilité métier et obligations cyber

Traçabilité applicative automatique sur l'ensemble des appels apps / front / back-office. Toutes les opérations sensibles (connexion, déconnexion, tentatives d'intrusion, récupération de paramètres sensibles, appel de routes spécifiques) sont tracées automatiquement au niveau de la gestion des tokens, **Secure by Design**.

### Bases de données natives intégrées

- **PostgreSQL** pour le relationnel,
- **MongoDB** pour l'objet,

natifs et sécurisés. Utilisables seuls ou conjointement. Types disponibles : ordinaire, redondé, sharding horizontal pour les gros projets. Mongo Time Series pour la traçabilité technique des audit logs.

Gestion native par WakaStart : accès, backups, restaurations à la demande, isolement entre tenants, suivi d'exploitation et monitoring (perf, saturation, remplissage disque). Les développeurs n'ont pas à se soucier des contraintes techniques quotidiennes.

### Bases de données mémoire Redis et Valkey

BDD ultra-rapides en RAM pour gros volumes d'appels, traitements, compteurs, échanges temps réel. Intégration native dans la console WakaStart.

### Stockage compatible S3, Object Storage OVH

Stockage sécurisé S3 chez OVH : classique, rapide, ou conforme HDS pour les données de santé. Sauvegardes et backups pilotés nativement par WakaStart, avec respect des règles cyber (backups chiffrés, hébergés sur un site distinct du datacenter principal).

Module de diffusion de médias intégré pour le streaming dynamique d'images, vidéos, sons.

### Allocation automatique des ressources sans DevOps

Création, allocation et hébergement intégrés et transparents pour les éditeurs partenaires. Scripts de déploiement Git → Kubernetes (prod / recette / dev) totalement automatisés via une interface web simple. Vérifications applicatives sécurité : absence de dépendances faillibles, tests OWASP, tests d'intrusion.

### Surveillance, exploitation, infrastructure et métriques

- **Prometheus** pour le suivi,
- **XDR-SIEM** basé sur **Wazuh** et **OpenTelemetry**.

Intégration native, accessible depuis l'unique plateforme d'administration WakaStart.

### Antivirus intégré

Système antivirus basé sur **ClamAV** : vérification de tous les fichiers intégrés / déposés / injectés vers la plateforme, avec sas d'entrée évitant la contamination.

### Gestion de crédit Pay As You Go

Système natif de gestion des crédits pour la consommation à l'usage :
- facturation propre WakaStart (volume BDD, taille serveurs),
- décompte interne aux applications hébergées (consommation des clients finaux).

Gestion nativement multi-tenant : regroupement par customer, network, app ou partenaire. **Stripe** intégré pour les paiements en ligne (abonnements et consommables).

## Déploiement SaaS : Web + Smartphone + Desktop

### Serveur Back commun à toutes les interfaces

Découpage Front/Back natif : la partie serveur (sécurité, accès, gestion des données) est développée une seule fois en **Nest.js**. Performance, sécurité et scalabilité via microservices intégrés.

### Interfaces Web modernes

Interfaces JavaScript modernes supportées par tous les navigateurs, responsive (desktop / tablette / smartphone).

### Apps natives iOS et Android : React Native

Applications natives en **React Native**, déployées sur les stores Apple et Android. Performance native + ergonomie mobile dédiée.

### Clients lourds macOS / Windows : Electron

**Electron** pour encapsuler le front web dans un exécutable déployable sur macOS (Silicon / Intel) ou Windows 10/11. Permet l'accès direct au disque dur, le pilotage de scanners, imprimantes, etc.

### API natives pour échanges machine-à-machine

API native sécurisée exposant les routes nécessaires aux échanges :
- avec les outils du marché : Zapier, Make, n8n,
- ou par accès direct (REST JSON, webhooks en retour).

## Hébergement des solutions WakaStart

Tarifs ci-dessous : hébergement chez **OVH** avec maintenance et SLA standards WakaStart. Contrats sur mesure ou SLA particulières négociables.

### Environnements de Production

#### Pack Hébergement StartUp — entrée de gamme

Pour applications en lancement, quelques milliers d'utilisateurs, usage modéré CPU/RAM/BDD :

- Plateforme d'exploitation, monitoring et supervision WakaStart
- Jusqu'à **4 microservices** : 4 vCPU + 8 Go RAM total
- **1 BDD** Postgres/MongoDB : 1 vCPU + 4 Go RAM + 8 Go disque
- **Stockage S3** : 50 Go inclus
- Pas d'extension possible (bascule vers ScaleUp au besoin)

#### Pack Hébergement ScaleUp — montée en charge pilotée

Pour partenaires en croissance, milliers à dizaines de milliers d'utilisateurs, scalabilité par microservice :

- Plateforme d'exploitation, monitoring et supervision WakaStart
- Jusqu'à **8 microservices** : 10 vCPU + 20 Go RAM global
- **1 BDD** Postgres/MongoDB : 2 vCPU + 8 Go RAM + 20 Go disque
- **Stockage S3** : 100 Go inclus
- Scalabilité disponible avec facturation à l'usage réel

#### Pack Hébergement Legacy — pour les gros projets

Pour partenaires Legacy (éditeurs matures), plusieurs milliers d'utilisateurs, scalabilité avancée microservice par microservice :

- Plateforme d'exploitation, monitoring et supervision WakaStart
- Jusqu'à **16 microservices** : 25 vCPU + 50 Go RAM global
- **1 ou 2 BDD** Postgres/MongoDB : 4 vCPU + 16 Go RAM + 50 Go disque global
- **Stockage S3** : 200 Go inclus
- Scalabilité disponible avec facturation à l'usage réel

#### Tarification consommations réelles

Au-delà des packs de base, ressources supplémentaires souscrivables (microservices, vCPU, espace disque, BDD additionnelles, RAM). Tarification sur mesure, basée sur les ressources réellement consommées chez OVH.

### Environnements de Dev / Recette

#### Pack Dev/Recette StartUp

- 3 microservices : 0,5 vCPU + 2 Go RAM
- 1 BDD privative Postgres/MongoDB : 1 Go RAM + 2 Go disque
- Stockage S3 : 5 Go (object storage)

#### Pack Dev/Recette ScaleUp

- 5 microservices : 1 vCPU + 3 Go RAM
- 1 BDD privative Postgres/MongoDB : 2 Go RAM + 5 Go disque
- Stockage S3 : 10 Go (object storage)

#### Pack Dev/Recette Legacy

- 12 microservices : 1,5 vCPU + 4 Go RAM
- 2 BDD privatives Postgres et/ou MongoDB : 4 Go RAM + 10 Go disque
- Stockage S3 : 20 Go (object storage)

### Hébergement on-premise

Pour ESN et grands comptes : prise en charge de l'hébergement on-premise de la base technologique WakaStart (app SaaS de pilotage + outils de monitoring/supervision/gestion de charge sur Kubernetes). Mise à disposition, évolution, maintenance et packs de sécurité font l'objet d'un abonnement spécifique.

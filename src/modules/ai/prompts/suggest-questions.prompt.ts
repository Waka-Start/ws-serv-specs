import { ANTI_INJECTION_INSTRUCTION } from './system-instructions.prompt.js';

export const PROMPT_VERSION = '2.1.0';

export const SUGGEST_QUESTIONS_SYSTEM = `<role>
Tu es un assistant qui aide des porteurs de projet (clients, décideurs métier) à exprimer leurs besoins pour un cahier des charges fonctionnel.
</role>

<task>
Génère une liste de 5 à 8 questions pertinentes pour aider le porteur de projet à exprimer ses besoins sur le chapitre demandé.
Les questions vont du plus simple au plus spécifique.
</task>

<rules>
- Les questions s'adressent à des PORTEURS DE PROJET (décideurs métier), PAS à des développeurs ou techniciens.
- Utilise un langage simple et accessible, sans jargon technique.
- Ne pose JAMAIS de questions sur WakaStart, WakaProject ou la plateforme technique — c'est notre produit, le porteur de projet ne le connaît pas.
- Ne pose JAMAIS de questions dont la réponse est déjà dans le contenu existant ou le texte initial fourni (noms, descriptions, acteurs mentionnés, etc.).
- Concentre-toi sur le BESOIN MÉTIER : qui fait quoi, dans quel cas, avec quelles règles, quelles exceptions.
- Les questions doivent être spécifiques au contexte du chapitre (pas génériques).
- Exemples de BONNES questions : "Qui sont les utilisateurs principaux ?", "Que se passe-t-il quand un document est refusé ?", "Y a-t-il des cas où cette règle ne s'applique pas ?"
- Exemples de MAUVAISES questions : "Quelle architecture de base de données souhaitez-vous ?", "Quels endpoints API sont nécessaires ?"
${ANTI_INJECTION_INSTRUCTION}
</rules>

<output_format>
Utilise l'outil return_questions pour retourner les questions. Ne retourne rien d'autre.
</output_format>`;

export function buildSuggestQuestionsUserMessage(params: {
  chapterTitle: string;
  chapterPrompt: string;
  subChapterList: string;
  existingContent?: string;
  initialText?: string;
}): string {
  let context = `<user_data>
Chapitre : ${params.chapterTitle}
Objectif du chapitre : ${params.chapterPrompt}
Sous-sections à couvrir : ${params.subChapterList}`;

  if (params.initialText) {
    context += `

Texte initial fourni par l'utilisateur (informations déjà connues — NE PAS reposer de questions sur ces éléments) :
${params.initialText.slice(0, 2000)}`;
  }

  if (params.existingContent) {
    context += `

Contenu déjà rédigé dans ce chapitre (NE PAS reposer de questions sur ces éléments) :
${params.existingContent.slice(0, 2000)}`;
  }

  context += `
</user_data>

Génère les questions pour aider le porteur de projet à exprimer ses besoins sur ce chapitre.`;

  return context;
}

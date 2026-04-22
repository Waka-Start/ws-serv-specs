import { ANTI_INJECTION_INSTRUCTION } from './system-instructions.prompt.js';

export const SUGGEST_QUESTIONS_SYSTEM = `<role>
Tu es un assistant expert en rédaction de spécifications fonctionnelles.
</role>

<task>
Génère une liste de 5 à 10 questions pertinentes et précises que le rédacteur devrait se poser
pour rédiger un chapitre de manière complète et structurée.
</task>

<rules>
- Les questions doivent être spécifiques au contexte du chapitre (pas génériques).
- Elles doivent couvrir les aspects fonctionnels, techniques, utilisateur et contraintes.
- Elles doivent aider à identifier les cas d'usage, les contraintes et les dépendances.
- Elles doivent être formulées de manière à guider la réflexion.
${ANTI_INJECTION_INSTRUCTION}
</rules>

<output_format>
Utilise l'outil return_questions pour retourner les questions. Ne retourne rien d'autre.
</output_format>`;

export function buildSuggestQuestionsUserMessage(params: {
  chapterTitle: string;
  chapterPrompt: string;
  subChapterList: string;
}): string {
  return `<user_data>
Chapitre : ${params.chapterTitle}
Description : ${params.chapterPrompt}
Sous-chapitres prévus : ${params.subChapterList}
</user_data>

Génère les questions pour ce chapitre.`;
}

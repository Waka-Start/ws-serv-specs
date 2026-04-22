import { ANTI_INJECTION_INSTRUCTION } from './system-instructions.prompt.js';

export const PROMPT_VERSION = '2026.04.22.1';

export const MODIFY_CONTENT_SYSTEM = `<role>
Tu es un assistant expert en rédaction de spécifications fonctionnelles.
</role>

<task>
Modifie uniquement le texte sélectionné dans le contexte du chapitre fourni.
Retourne le contenu COMPLET du chapitre avec la modification appliquée.
</task>

<rules>
- Ne modifie que la portion sélectionnée, conserve le reste intégralement.
- Respecte le style et la structure du document existant.
- N'ajoute pas de commentaires, titres ou explications hors du contenu demandé.
${ANTI_INJECTION_INSTRUCTION}
</rules>

<output_format>
Retourne uniquement le contenu complet du chapitre, sans texte supplémentaire.
</output_format>`;

export function buildModifyContentUserMessage(params: {
  chapterContent: string;
  selectedText: string;
  userInstruction: string;
}): string {
  return `Contexte du chapitre :
${params.chapterContent}

<user_data>
Texte sélectionné à modifier :
${params.selectedText}

Instruction :
${params.userInstruction}
</user_data>`;
}

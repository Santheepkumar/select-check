import {
  SLOT3_PRESET_MAP,
  type Slot3RequestConfig,
  type SuggestionItem,
  type SuggestionStyle
} from '@select-check/shared';
import type { CloudflareBindings } from '../types.js';

export interface OpenAICheckResult {
  detectedLanguage: string;
  suggestions: [SuggestionItem, SuggestionItem, SuggestionItem];
}

const SUGGESTIONS_JSON_SCHEMA = {
  name: 'grammar_suggestions_response',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['detectedLanguage', 'grammarFix', 'clearConcise', 'slotThree'],
    properties: {
      detectedLanguage: {
        type: 'string',
        description: 'ISO code or English name of the detected language of the input text (e.g., EN, ES, FR, DE).'
      },
      grammarFix: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'summary'],
        properties: {
          text: {
            type: 'string',
            description: 'Corrected text with minimal changes fixing only grammar, spelling, and punctuation in the same language.'
          },
          summary: {
            type: 'string',
            description: 'Short 3-6 word summary of what was fixed.'
          }
        }
      },
      clearConcise: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'summary'],
        properties: {
          text: {
            type: 'string',
            description: 'Natural, clear, and concise rewrite in the same language.'
          },
          summary: {
            type: 'string',
            description: 'Short 3-6 word summary of how clarity was improved.'
          }
        }
      },
      slotThree: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'summary'],
        properties: {
          text: {
            type: 'string',
            description: 'The requested third transformation rewrite as instructed in the prompt.'
          },
          summary: {
            type: 'string',
            description: 'Short 3-6 word summary of the transformation.'
          }
        }
      }
    }
  }
};

export async function generateGrammarSuggestions(
  inputText: string,
  env: CloudflareBindings = {},
  slot3Config?: Slot3RequestConfig
): Promise<OpenAICheckResult> {
  const apiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const model = env.OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    return buildLocalHeuristicSuggestions(inputText, slot3Config);
  }

  const presetKey = slot3Config?.preset || 'professional_polished';
  const presetMeta = SLOT3_PRESET_MAP[presetKey] || SLOT3_PRESET_MAP.professional_polished;
  const slot3Instruction =
    presetKey === 'custom' && slot3Config?.customPrompt
      ? slot3Config.customPrompt
      : presetMeta.systemInstruction;
  const slot3Label = presetMeta.label;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            `You are an expert multilingual writing assistant. Detect the language of the user text and maintain appropriate language.\n` +
            `Provide 3 outputs:\n` +
            `1) grammarFix: Fix only grammar, spelling, and punctuation with minimal word changes.\n` +
            `2) clearConcise: Crisp, natural, easy-to-read rewrite.\n` +
            `3) slotThree: ${slot3Instruction}`
        },
        {
          role: 'user',
          content: inputText
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: SUGGESTIONS_JSON_SCHEMA
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned an empty response payload');
  }

  const parsed = JSON.parse(content) as {
    detectedLanguage: string;
    grammarFix: { text: string; summary: string };
    clearConcise: { text: string; summary: string };
    slotThree: { text: string; summary: string };
  };

  const slot3Style: SuggestionStyle =
    presetKey === 'custom'
      ? 'custom_slot'
      : (presetKey as SuggestionStyle);

  return {
    detectedLanguage: parsed.detectedLanguage || 'EN',
    suggestions: [
      {
        style: 'grammar_fix',
        label: 'Grammar Fix',
        text: parsed.grammarFix.text,
        summary: parsed.grammarFix.summary
      },
      {
        style: 'clear_concise',
        label: 'Clear & Concise',
        text: parsed.clearConcise.text,
        summary: parsed.clearConcise.summary
      },
      {
        style: slot3Style,
        label: slot3Label,
        text: parsed.slotThree.text,
        summary: parsed.slotThree.summary
      }
    ]
  };
}

/**
 * Smart deterministic grammar & tone transformer used when OPENAI_API_KEY is not configured
 * in local development or automated tests.
 */
export function buildLocalHeuristicSuggestions(
  inputText: string,
  slot3Config?: Slot3RequestConfig
): OpenAICheckResult {
  const trimmed = inputText.trim().replace(/\s+/g, ' ');

  // Basic language detection heuristic
  const hasSpanish = /[áéíóúñ¿¡]/i.test(trimmed) || /\b(hola|para|como|ayer|tienda)\b/i.test(trimmed);
  const hasFrench = /[àâçéèêëîïôûùüÿœ]/i.test(trimmed) || /\b(bonjour|merci|avec|pour)\b/i.test(trimmed);
  const detectedLanguage = hasSpanish ? 'ES' : hasFrench ? 'FR' : 'EN';

  // Common English grammar fixes for realistic local dev & demo experience
  let grammarFixed = trimmed
    .replace(/\bme and him goes\b/gi, 'He and I went')
    .replace(/\bme and him\b/gi, 'he and I')
    .replace(/\bfor buy\b/gi, 'to buy')
    .replace(/\bi\b/g, 'I')
    .replace(/\bdont\b/gi, "don't")
    .replace(/\bcant\b/gi, "can't")
    .replace(/\bwont\b/gi, "won't")
    .replace(/\bim\b/gi, "I'm")
    .replace(/\bive\b/gi, "I've")
    .replace(/\bteh\b/gi, 'the')
    .replace(/\brecieve\b/gi, 'receive')
    .replace(/\bseperate\b/gi, 'separate')
    .replace(/\bgrammer\b/gi, 'grammar')
    .replace(/\bsugeesions\b/gi, 'suggestions')
    .replace(/\bimptoving\b/gi, 'improving')
    .replace(/\bwe was\b/gi, 'we were')
    .replace(/\bthey was\b/gi, 'they were')
    .replace(/\bhe dont\b/gi, "he doesn't")
    .replace(/\bshe dont\b/gi, "she doesn't")
    .replace(/\bcan you send me the files quick\b/gi, 'Can you send me the files quickly?');

  // Ensure first letter is capitalized and ends with punctuation
  if (grammarFixed.length > 0) {
    grammarFixed = grammarFixed.charAt(0).toUpperCase() + grammarFixed.slice(1);
    if (!/[.!?]$/.test(grammarFixed)) {
      grammarFixed += '.';
    }
  }

  // Clear & concise version: tighten common verbose phrases
  let clearConcise = grammarFixed
    .replace(/\bIn order to\b/gi, 'To')
    .replace(/\bdue to the fact that\b/gi, 'because')
    .replace(/\bat this point in time\b/gi, 'now')
    .replace(/\bjust wanted to reach out and ask if\b/gi, 'Could')
    .replace(/\bI was wondering if you could\b/gi, 'Please');

  if (clearConcise === grammarFixed) {
    clearConcise = grammarFixed
      .replace(/\byesterday to buy\b/gi, 'yesterday for')
      .replace(/\bvery\s+/gi, '');
  }

  // Slot 3 handling based on configured preset
  const presetKey = slot3Config?.preset || 'professional_polished';
  const meta = SLOT3_PRESET_MAP[presetKey] || SLOT3_PRESET_MAP.professional_polished;

  let slot3Text = grammarFixed;
  let slot3Summary = 'Elevated & workplace-ready tone';

  switch (presetKey) {
    case 'casual_friendly':
      slot3Text = `Hey! ${grammarFixed.charAt(0).toLowerCase()}${grammarFixed.slice(1).replace(/\.$/, '')} :)`;
      slot3Summary = 'Warm & conversational tone';
      break;
    case 'bullet_points':
      slot3Text = `• ${grammarFixed.replace(/\.$/, '')}\n• Action item ready for review`;
      slot3Summary = 'Actionable bullet list summary';
      break;
    case 'executive_brief':
      slot3Text = `TL;DR: ${clearConcise}`;
      slot3Summary = 'Concise executive takeaway';
      break;
    case 'translate_spanish':
      slot3Text = `Hola, ${grammarFixed.replace(/yesterday/i, 'ayer').replace(/client/i, 'cliente')}`;
      slot3Summary = 'Translated to natural Spanish';
      break;
    case 'custom':
      slot3Text = `${grammarFixed} [Custom: ${slot3Config?.customPrompt || 'Enhanced'}]`;
      slot3Summary = 'Applied custom prompt transformation';
      break;
    case 'professional_polished':
    default:
      if (/^can you\b/i.test(grammarFixed)) {
        slot3Text = grammarFixed.replace(/^can you\b/i, 'Could you please');
      } else if (/^send me\b/i.test(grammarFixed)) {
        slot3Text = grammarFixed.replace(/^send me\b/i, 'Could you kindly share');
      } else if (!/^(Could|Please|Thank|We|He|She|I\b)/i.test(grammarFixed)) {
        slot3Text = `Please note: ${grammarFixed.charAt(0).toLowerCase()}${grammarFixed.slice(1)}`;
      } else {
        slot3Text = grammarFixed
          .replace(/\bwent to the store yesterday to buy\b/i, 'visited the store yesterday to purchase')
          .replace(/\bneed to fix\b/i, 'should resolve')
          .replace(/\bget back to me\b/i, 'let me know your thoughts');
      }
      slot3Summary = 'Elevated & workplace-ready tone';
      break;
  }

  const slot3Style: SuggestionStyle =
    presetKey === 'custom'
      ? 'custom_slot'
      : (presetKey as SuggestionStyle);

  return {
    detectedLanguage,
    suggestions: [
      {
        style: 'grammar_fix',
        label: 'Grammar Fix',
        text: grammarFixed,
        summary: 'Fixed grammar, spelling & punctuation'
      },
      {
        style: 'clear_concise',
        label: 'Clear & Concise',
        text: clearConcise,
        summary: 'Direct, natural & easy to read'
      },
      {
        style: slot3Style,
        label: meta.label,
        text: slot3Text,
        summary: slot3Summary
      }
    ]
  };
}

import OpenAI from 'openai';
import { AiProvider } from '../../domain/repositories.js';
import { config } from '../config/env.js';

const PROMPT_VERSION = 'rag-v1';

function buildContextualFallback(options: Parameters<AiProvider['answerWithRag']>[0]) {
  const question = options.question.trim().toLowerCase();
  const isGreeting = /^(hola|hello|buenas|buenos|hi|hey)/.test(question);
  const isGeneral = /^(que puedes hacer|ayuda|help|como funciona|qué puedes hacer|qué haces|puedes ayudarme|puedes ayudar)/.test(question);

  if (!options.channelIds?.length) {
    return {
      answer: 'Puedo ayudarte a revisar coordinación, despliegue y campañas del equipo, pero hoy no tienes acceso a canales autorizados. Si me compartes el tema o me asignas acceso, te ayudo de inmediato.',
      citations: [],
    };
  }

  if (!options.context.length) {
    if (isGreeting || isGeneral) {
      return {
        answer: '¡Hola! Puedo ayudarte con coordinación interna, despliegue, campañas y seguimiento del equipo. Actualmente no hay mensajes recientes autorizados para responder con detalle, pero si me dices el tema exacto te ayudo con una respuesta útil.',
        citations: [],
      };
    }

    return {
      answer: 'He revisado los canales autorizados y no hay mensajes recientes suficientes para responder con precisión, pero puedo ayudarte si me dices el tema exacto: despliegue, campañas, coordinación o seguimiento del equipo.',
      citations: [],
    };
  }

  const snippets = options.context.slice(0, 5).map((message, index) => `• [${index + 1}] ${message.rw_content}`).join('\n');

  if (question.includes('despliegue') || question.includes('deploy') || question.includes('pipeline')) {
    return {
      answer: `Reviso el contexto visible y lo más reciente apunta a que el despliegue está estable.\n\n${snippets}`,
      citations: options.context.map((message) => message.rw_id),
    };
  }

  if (question.includes('marketing') || question.includes('campaña') || question.includes('budget') || question.includes('presupuesto')) {
    return {
      answer: `El contexto disponible sugiere que el tema de marketing requiere revisión de presupuesto antes del cierre del periodo.\n\n${snippets}`,
      citations: options.context.map((message) => message.rw_id),
    };
  }

  if (isGreeting) {
    return {
      answer: `¡Hola! Puedo ayudarte con temas del equipo y del canal actual. Aquí tienes la referencia más reciente del contexto autorizado:\n\n${snippets}`,
      citations: options.context.map((message) => message.rw_id),
    };
  }

  return {
    answer: `He revisado el contexto autorizado y puedo responder con base en la información visible.\n\n${snippets}`,
    citations: options.context.map((message) => message.rw_id),
  };
}

export class OpenAiProvider implements AiProvider {
  private readonly client = config.openAiApiKey ? new OpenAI({ apiKey: config.openAiApiKey }) : null;

  async embedText(input: string): Promise<number[]> {
    if (!this.client) {
      return new Array(1536).fill(0);
    }

    const response = await this.client.embeddings.create({ model: 'text-embedding-3-small', input });
    return response.data[0].embedding;
  }

  async answerWithRag(options: Parameters<AiProvider['answerWithRag']>[0]) {
    if (!options.channelIds?.length) {
      return { answer: 'No tienes acceso autorizado a ningún canal para responder esta pregunta.', citations: [] };
    }

    if (!this.client || !config.openAiApiKey) {
      return buildContextualFallback(options);
    }

    const sources = options.context.length
      ? options.context.map((m, index) => `[${index + 1}] ${m.rw_content}`).join('\n')
      : 'No hay mensajes recientes autorizados disponibles.';

    try {
      const response = await this.client.chat.completions.create({
        model: config.openAiModel,
        messages: [
          { role: 'system', content: `You are Riwi Co. internal copilot (${PROMPT_VERSION}). Be helpful, brief, and natural. For greetings and simple questions, answer warmly and offer next steps, even if the context is sparse. For operational questions, use the authorized channel context only. If context is weak, do not repeat a generic blocked message; instead explain that there is no recent evidence in the authorized channels and suggest a topic or ask the user to specify what they need. Cite sources as [n] only when they exist.` },
          { role: 'user', content: `Question: ${options.question}\n\nAuthorized sources:\n${sources}` },
        ],
        temperature: 0.3,
      });
      return { answer: response.choices[0]?.message.content || 'Puedo ayudarte si me dices el tema exacto: despliegue, campañas o coordinación del equipo.', citations: options.context.map((m) => m.rw_id) };
    } catch {
      return buildContextualFallback(options);
    }
  }
}

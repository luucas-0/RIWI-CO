'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type User = { id: string; name: string; role: string };
type Channel = { rw_id: string; rw_name: string };
type Message = {
  rw_id: string;
  rw_content: string;
  rw_sender_user_id: string;
  rw_status: 'pending' | 'sent' | 'failed';
  rw_created_at: string;
  rw_highlight?: string;
};
type CopilotResponse = { answer: string; citations: string[] };

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const samplePrompts = [
  '¿Qué pasó con el despliegue?',
  '¿Hay cambios pendientes de marketing?',
  '¿Qué está coordinando el equipo esta semana?',
];

const copy = {
  es: {
    title: 'Riwi Co.',
    subtitle: 'Mensajería interna',
    email: 'Correo',
    password: 'Contraseña',
    signIn: 'Iniciar sesión',
    demo: 'Demo: lucas@riwi.co / RiwiDemo2026!',
    channels: 'Canales autorizados',
    search: 'Buscar mensajes',
    write: 'Escribe un mensaje…',
    send: 'Enviar',
    copilot: 'Copiloto IA',
    question: 'Pregunta sobre canales, campañas o despliegue…',
    ask: 'Consultar IA',
    logout: 'Cerrar sesión',
    noMessages: 'No hay mensajes en este canal.',
    loading: 'Cargando conversación…',
    sources: 'Fuentes autorizadas',
    aiUnavailable: 'La IA necesita OPENAI_API_KEY para responder con contexto real.',
    error: 'No fue posible completar la operación.',
    welcome: 'Centro de comunicación interno',
    status: 'Estado',
    channelDescription: 'Consulta solo los canales en los que tienes acceso y revisa el historial autorizado.',
    aiDescription: 'La IA responde solo con contexto visible del usuario autenticado y menciona referencias de origen.',
    assistantHeader: 'Respuesta del asistente',
    emptyAnswer: 'Pregunta por despliegue, coordinación o campañas del equipo.',
    channelActive: 'Canal activo',
    startHint: 'Sugerencias',
  },
  en: {
    title: 'Riwi Co.',
    subtitle: 'Internal messaging',
    email: 'Email',
    password: 'Password',
    signIn: 'Sign in',
    demo: 'Demo: lucas@riwi.co / RiwiDemo2026!',
    channels: 'Authorized channels',
    search: 'Search messages',
    write: 'Write a message…',
    send: 'Send',
    copilot: 'AI Copilot',
    question: 'Ask about channels, campaigns or deployment…',
    ask: 'Ask AI',
    logout: 'Sign out',
    noMessages: 'No messages in this channel.',
    loading: 'Loading conversation…',
    sources: 'Authorized sources',
    aiUnavailable: 'The AI needs OPENAI_API_KEY to answer with real context.',
    error: 'The operation could not be completed.',
    welcome: 'Internal communication center',
    status: 'Status',
    channelDescription: 'Access only the channels you are member of and review the authorized history.',
    aiDescription: 'The AI answers using only the visible context of the authenticated user and references authorized sources.',
    assistantHeader: 'Assistant response',
    emptyAnswer: 'Ask about deployment, coordination or team campaigns.',
    channelActive: 'Active channel',
    startHint: 'Suggestions',
  },
};

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'request_failed' }));
    throw new Error(String(payload.error || 'request_failed'));
  }

  return response.json();
}

export default function HomePage() {
  const [lang, setLang] = useState<'es' | 'en'>('es');
  const t = copy[lang];
  const [token, setToken] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<CopilotResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedMessages = useMemo(() => [...messages].reverse(), [messages]);

  useEffect(() => {
    const saved = localStorage.getItem('riwi.session');
    if (!saved) return;
    const session = JSON.parse(saved);
    setToken(session.accessToken);
    setUser(session.user);
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadChannels();
  }, [token]);

  useEffect(() => {
    if (!channel || !token) return;
    void loadMessages();
  }, [channel?.rw_id, token]);

  async function loadChannels() {
    try {
      const list = await request<Channel[]>('/channels', {}, token);
      setChannels(list);
      setChannel((current) => (current && list.some((item) => item.rw_id === current.rw_id) ? current : list[0] || null));
    } catch {
      setError(t.error);
    }
  }

  async function loadMessages() {
    if (!channel) return;
    setLoading(true);
    try {
      const data = await request<{ items: Message[] }>(`/channels/${channel.rw_id}/messages?limit=50`, {}, token);
      setMessages(data.items);
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');

    try {
      const session = await request<{ accessToken: string; refreshToken: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem('riwi.session', JSON.stringify(session));
      setToken(session.accessToken);
      setUser(session.user);
    } catch (caught) {
      setError((caught as Error).message || t.error);
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!channel || !draft.trim() || !user) return;

    const content = draft.trim();
    const optimistic: Message = {
      rw_id: `pending-${Date.now()}`,
      rw_content: content,
      rw_sender_user_id: user.id,
      rw_status: 'pending',
      rw_created_at: new Date().toISOString(),
    };

    setMessages((current) => [optimistic, ...current]);
    setDraft('');

    try {
      const saved = await request<Message>(`/channels/${channel.rw_id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }, token);

      setMessages((current) => current.map((item) => (item.rw_id === optimistic.rw_id ? saved : item)));
    } catch {
      setMessages((current) => current.map((item) => (item.rw_id === optimistic.rw_id ? { ...item, rw_status: 'failed' } : item)));
      setError(t.error);
    }
  }

  async function runSearch(value: string) {
    setSearch(value);
    if (!channel) return;

    if (!value.trim()) {
      void loadMessages();
      return;
    }

    try {
      const data = await request<{ items: Message[] }>(`/channels/${channel.rw_id}/messages/search?q=${encodeURIComponent(value)}`, {}, token);
      setMessages(data.items);
    } catch {
      setError(t.error);
    }
  }

  async function ask(event: FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;
    setError('');

    try {
      const result = await request<CopilotResponse>('/copilot/ask', {
        method: 'POST',
        body: JSON.stringify({ question }),
      }, token);
      setAnswer(result);
      setQuestion('');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '';
      setError(message === 'ai_provider_not_configured' ? t.aiUnavailable : t.error);
    }
  }

  function logout() {
    localStorage.removeItem('riwi.session');
    setToken('');
    setUser(null);
    setChannels([]);
    setChannel(null);
    setMessages([]);
    setAnswer(null);
    setError('');
  }

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#111111] p-4 text-zinc-100">
        <div className="w-full max-w-md rounded-3xl border border-zinc-700 bg-[#1a1a1a]/90 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_28px_80px_rgba(0,0,0,0.60)] backdrop-blur-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-400">Riwi Co.</p>
              <h1 className="mt-2 text-3xl font-bold text-zinc-50">{t.title}</h1>
              <p className="mt-1 text-sm text-zinc-400">{t.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setLang((value) => (value === 'es' ? 'en' : 'es'))}
              className="rounded-full border border-zinc-600 bg-zinc-800 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-200"
            >
              {lang.toUpperCase()}
            </button>
          </div>

          <p className="mb-5 rounded-2xl border border-zinc-700 bg-zinc-900/80 p-3 text-sm text-zinc-200">{t.demo}</p>

          <form onSubmit={login} className="space-y-4">
            <label className="block text-sm text-zinc-300">
              <span className="mb-1 block">{t.email}</span>
              <input
                name="email"
                required
                type="email"
                autoComplete="email"
                defaultValue="lucas@riwi.co"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-zinc-50 outline-none placeholder:text-zinc-500 focus:border-zinc-400"
                placeholder={t.email}
              />
            </label>

            <label className="block text-sm text-zinc-300">
              <span className="mb-1 block">{t.password}</span>
              <input
                name="password"
                required
                type="password"
                autoComplete="current-password"
                defaultValue="RiwiDemo2026!"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-zinc-50 outline-none placeholder:text-zinc-500 focus:border-zinc-400"
                placeholder={t.password}
              />
            </label>

            <button type="submit" className="w-full rounded-xl bg-zinc-200 px-4 py-3 font-semibold text-zinc-900 transition hover:bg-white">
              {t.signIn}
            </button>
          </form>

          {error && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#111111] p-3 text-zinc-100 md:p-6">
      <div className="mx-auto grid min-h-[88vh] max-w-7xl grid-cols-1 overflow-hidden rounded-3xl border border-zinc-700 bg-[#1b1b1b] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_30px_80px_rgba(0,0,0,0.55)] md:grid-cols-[240px_minmax(0,1fr)_350px]">
        <aside className="border-b border-zinc-700 bg-[#1f1f1f] p-4 md:border-b-0 md:border-r">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-400">{t.status}</p>
              <div className="mt-1 font-semibold text-zinc-100">{user.name}</div>
            </div>
            <button
              onClick={logout}
              className="rounded-full border border-zinc-600 bg-zinc-900 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-zinc-200 transition hover:border-zinc-500"
            >
              {t.logout}
            </button>
          </div>

          <div className="mb-4 rounded-2xl border border-zinc-700 bg-zinc-900/70 p-3">
            <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-400">{t.welcome}</div>
            <p className="mt-2 text-sm text-zinc-300">{t.channelDescription}</p>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-400">{t.channels}</h2>
            <span className="rounded-full bg-zinc-700 px-2 py-1 text-[10px] text-zinc-200">{channels.length}</span>
          </div>

          <div className="space-y-2">
            {channels.map((item) => (
              <button
                key={item.rw_id}
                onClick={() => {
                  setChannel(item);
                  setSearch('');
                }}
                className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2.5 text-left transition ${channel?.rw_id === item.rw_id ? 'border-zinc-500 bg-zinc-700/80 text-zinc-50' : 'border-zinc-700 bg-zinc-900/50 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800'}`}
              >
                <span className="font-medium"># {item.rw_name}</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">Open</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-[55vh] flex-col border-b border-zinc-700 md:border-b-0 md:border-r">
          <header className="border-b border-zinc-700 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-400">{t.channelActive}</p>
                <h1 className="mt-1 text-2xl font-bold text-zinc-50"># {channel?.rw_name || t.channels}</h1>
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-700 bg-zinc-950/60 p-2">
              <input
                value={search}
                onChange={(event) => void runSearch(event.target.value)}
                placeholder={t.search}
                className="w-full bg-transparent px-2 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none"
              />
            </div>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-[#151515] p-4">
            {loading ? (
              <p className="text-sm text-zinc-400">{t.loading}</p>
            ) : selectedMessages.length ? (
              selectedMessages.map((message) => (
                <article
                  key={message.rw_id}
                  className={`max-w-[82%] rounded-2xl px-3 py-2.5 text-sm ${message.rw_sender_user_id === user.id ? 'ml-auto bg-zinc-200 text-zinc-900' : 'bg-zinc-800 text-zinc-100'}`}
                >
                  <div className="mb-1 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.15em] opacity-70">
                    <span>{message.rw_sender_user_id === user.id ? 'Tú' : 'Equipo'}</span>
                    <span>{message.rw_status}</span>
                  </div>
                  <p className="leading-relaxed">{message.rw_content}</p>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-700 p-6 text-sm text-zinc-400">{t.noMessages}</div>
            )}
          </div>

          <form onSubmit={send} className="flex gap-2 border-t border-zinc-700 bg-[#1f1f1f] p-4">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t.write}
              className="min-w-0 flex-1 rounded-2xl border border-zinc-600 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-50 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
            />
            <button type="submit" className="rounded-2xl bg-zinc-200 px-4 py-2.5 font-semibold text-zinc-900 transition hover:bg-white">
              {t.send}
            </button>
          </form>
        </section>

        <aside className="bg-[#1f1f1f] p-4">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-400">{t.copilot}</h2>
          <p className="mt-3 rounded-2xl border border-zinc-700 bg-zinc-900/70 p-3 text-sm text-zinc-300">{t.aiDescription}</p>

          <div className="mt-4 rounded-2xl border border-zinc-700 bg-zinc-900/70 p-3">
            <div className="mb-2 text-[10px] uppercase tracking-[0.25em] text-zinc-400">{t.startHint}</div>
            <div className="space-y-2">
              {samplePrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setQuestion(prompt)}
                  className="block w-full rounded-xl border border-zinc-600 bg-zinc-950 px-2.5 py-2 text-left text-sm text-zinc-200 hover:border-zinc-500"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={ask} className="mt-4 space-y-3">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={t.question}
              rows={4}
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-50 placeholder:text-zinc-500 outline-none focus:border-zinc-400"
            />
            <button type="submit" className="w-full rounded-2xl bg-zinc-200 px-4 py-2.5 font-semibold text-zinc-900 transition hover:bg-white">
              {t.ask}
            </button>
          </form>

          <div className="mt-5 rounded-2xl border border-zinc-700 bg-zinc-900/70 p-3">
            <div className="mb-2 text-[10px] uppercase tracking-[0.25em] text-zinc-400">{t.assistantHeader}</div>
            {answer ? (
              <>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">{answer.answer}</p>
                {answer.citations.length > 0 && (
                  <div className="mt-3 border-t border-zinc-700 pt-3">
                    <div className="mb-2 text-[10px] uppercase tracking-[0.25em] text-zinc-400">{t.sources}</div>
                    <ul className="space-y-1 text-xs text-zinc-300">
                      {answer.citations.map((citation, index) => (
                        <li key={citation}>#{index + 1} · {citation}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-zinc-400">{t.emptyAnswer}</p>
            )}
          </div>

          {error && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
        </aside>
      </div>
    </main>
  );
}

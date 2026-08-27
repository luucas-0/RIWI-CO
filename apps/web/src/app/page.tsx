export default function HomePage() {
  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-7xl rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="grid min-h-[80vh] grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)_340px]">
          <aside className="border-b border-slate-200 bg-slate-50 p-4 md:border-b-0 md:border-r">
            <h2 className="text-lg font-semibold">Canales</h2>
            <div className="mt-4 space-y-2">
              <div className="rounded-lg bg-indigo-50 p-3 text-indigo-700"># engineering</div>
              <div className="rounded-lg p-3 text-slate-600"># marketing</div>
            </div>
          </aside>

          <section className="flex min-h-0 flex-col border-b border-slate-200 bg-white md:border-b-0 md:border-r">
            <header className="border-b border-slate-200 p-4">
              <h1 className="text-xl font-semibold"># engineering</h1>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              <div className="max-w-[75%] rounded-xl bg-slate-100 p-3 text-sm">Pipeline stable after rollback.</div>
              <div className="ml-auto max-w-[75%] rounded-xl bg-indigo-600 p-3 text-sm text-white">Yes, we can proceed.</div>
            </div>
            <div className="border-t border-slate-200 p-4">
              <div className="flex gap-2">
                <input className="flex-1 rounded-xl border border-slate-300 px-3 py-2" placeholder="Escribe un mensaje..." />
                <button className="rounded-xl bg-indigo-600 px-4 py-2 text-white">Enviar</button>
              </div>
            </div>
          </section>

          <aside className="bg-slate-50 p-4">
            <h2 className="text-lg font-semibold">Copiloto IA</h2>
            <div className="mt-4 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm text-slate-600">Citas y fuentes del contexto autorizado.</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

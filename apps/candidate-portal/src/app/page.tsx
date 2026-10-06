export default function Home() {
  return (
    <main className="mx-auto max-w-xl px-6 py-20">
      <h1 className="text-2xl font-semibold">Intervue AI</h1>
      <p className="muted mt-2 text-sm leading-relaxed">
        This is the candidate interview portal. You reach it through the personal
        interview link in your invitation email — no account needed.
      </p>

      <div className="card mt-8 p-5 text-sm">
        <p className="font-medium">Have a link?</p>
        <p className="muted mt-1 text-xs">
          It looks like <code>/interview/&lt;your-token&gt;</code>. Open it in this
          browser to continue where you left off.
        </p>
      </div>
    </main>
  );
}

'use client'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ro">
      <body className="flex min-h-screen items-center justify-center bg-surface p-6 text-on-surface">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Ceva nu a mers bine</h1>
          <p className="mt-4">A apărut o eroare neașteptată. Încearcă din nou.</p>
          <button type="button" onClick={reset} className="mt-6 min-h-11 rounded-md bg-primary px-4 font-semibold text-on-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Încearcă din nou</button>
        </div>
      </body>
    </html>
  )
}

// app/routes/missing.tsx
export function meta() {
  return [{ title: "這裡沒有東西" }];
}

export default function MissingPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center space-y-4">
      <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">404-ish</p>
      <h1 className="text-3xl font-bold text-neutral-900">這裡沒有東西</h1>
      <p className="text-neutral-600">你找到了一個空白的走廊。這條路不通。</p>
      <p className="text-sm text-neutral-500">知道正確的路徑才能抵達目的地。</p>
    </main>
  );
}

export default function PlaceholderPage({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <h1 className="font-serif text-3xl font-bold">{title}</h1>
      <div className="mt-6 rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-muted">
        {note ?? "Halaman ini sedang dikembangkan."}
      </div>
    </div>
  );
}
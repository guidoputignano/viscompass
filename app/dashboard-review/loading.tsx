export default function DashboardLoading() {
  return (
    <div className="flex w-full animate-pulse flex-col gap-7">
      <div className="space-y-3 border-b border-border pb-7">
        <div className="h-3 w-40 rounded bg-secondary" />
        <div className="h-10 max-w-2xl rounded bg-secondary" />
        <div className="h-4 max-w-3xl rounded bg-secondary" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-36 rounded-2xl border border-border bg-card" />)}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.8fr)]">
        <div className="h-80 rounded-2xl border border-border bg-card" />
        <div className="h-80 rounded-2xl border border-border bg-card" />
      </div>
    </div>
  );
}

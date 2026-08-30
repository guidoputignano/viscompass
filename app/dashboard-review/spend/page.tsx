import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SpendSankey } from "@/components/dashboard-review/spend-sankey";
import { getSpendFlows, resolveScope } from "@/lib/dashboard-review/queries";

export default async function SpendPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { org } = await searchParams;
  const scope = await resolveScope(org);
  const flows = await getSpendFlows(scope);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-primary">M1</p>
        <h1 className="font-display mt-1 text-2xl md:text-3xl">Cruscotto direzionale della spesa</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Come la spesa nell&apos;ambito selezionato si distribuisce per canale, categoria ATC ed
          esito originator/biosimilare.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Flusso della spesa</CardTitle>
          <CardDescription>
            Canale → categoria ATC → originator/biosimilare, spessore proporzionale alla spesa
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="min-w-[640px]">
            <SpendSankey data={flows} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

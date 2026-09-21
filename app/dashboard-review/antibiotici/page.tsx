import { redirect } from 'next/navigation';

// Verified private workbook view replaces the former synthetic fallback.
export default function AntibioticiPage() {
  redirect('/dashboard-review/pillar-a');
}

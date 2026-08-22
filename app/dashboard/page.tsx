import type { Metadata } from "next";
import PharmacyDashboard from "./PharmacyDashboard";

export const metadata: Metadata = {
  title: "VIS PHARMA COMPASS — Dashboard",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <main style={{ minHeight: "100vh" }}>
      <PharmacyDashboard />
    </main>
  );
}

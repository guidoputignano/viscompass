"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export function LogoutButton({
  label = "Logout",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <Button variant="ghost" size="sm" className={cn("justify-start", className)} onClick={logout}>
      <LogOut size={14} /> {label}
    </Button>
  );
}

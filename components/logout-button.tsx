"use client";

import { signOut } from "@/app/auth/actions";
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
    // On the server: the HttpOnly session cookie is out of the browser's reach (XC-X3.3).
    await signOut();
    router.push("/auth/login");
    router.refresh();
  };

  return (
    <Button variant="ghost" size="sm" className={cn("justify-start", className)} onClick={logout}>
      <LogOut size={14} /> {label}
    </Button>
  );
}

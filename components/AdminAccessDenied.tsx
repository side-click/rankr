import { ShieldAlert } from "lucide-react";
import { RetroWindow } from "@/components/RetroWindow";

interface AdminAccessDeniedProps {
  title?: string;
  heading?: string;
  message?: string;
}

export function AdminAccessDenied({
  title = "Admin Console — Access Denied",
  heading = "Admin Access Required",
  message = "You do not have permission to access this page.",
}: AdminAccessDeniedProps) {
  return (
    <RetroWindow title={title} theme="xp">
      <div className="py-8 px-4 text-center space-y-3">
        <ShieldAlert className="w-10 h-10 mx-auto text-[#ff857a]" />
        <h1 className="text-base font-bold text-[#f0ede0]">{heading}</h1>
        <p className="text-xs text-[#a6a89e] max-w-md mx-auto">{message}</p>
      </div>
    </RetroWindow>
  );
}

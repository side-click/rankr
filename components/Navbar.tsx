import { AuthButton } from "@/components/AuthButton";
import { HeaderNav } from "@/components/HeaderNav";

interface NavbarProps {
  user: {
    id: string;
    username: string;
    avatarUrl: string | null;
  } | null;
  isAdmin: boolean;
  isOperator?: boolean;
  hasMatchHubAccess?: boolean;
  requireAllowlist: boolean;
}

export function Navbar({
  user,
  isAdmin,
  isOperator = false,
  hasMatchHubAccess = false,
  requireAllowlist,
}: NavbarProps) {
  return (
    <header className="xp-taskbar sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 h-16 flex items-center justify-between gap-2 sm:gap-3">
        <HeaderNav
          isLoggedIn={Boolean(user)}
          isAdmin={isAdmin}
          isOperator={isOperator}
          hasMatchHubAccess={hasMatchHubAccess}
        />

        <AuthButton requireAllowlist={requireAllowlist} user={user} />
      </div>
    </header>
  );
}

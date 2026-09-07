import { AppShell } from "@/components/app-shell";
import { requireActiveProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { identity, profile } = await requireActiveProfile();
  const name = profile.full_name || identity.fullName || identity.email;

  return (
    <AppShell name={name} email={identity.email} role={profile.role}>
      {children}
    </AppShell>
  );
}

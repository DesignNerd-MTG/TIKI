import { AppShell } from "@/components/app-shell";
import { requireActiveProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolveTheme } from "@/lib/theme";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { identity, profile } = await requireActiveProfile();
  const supabase = await createClient();
  const { data: settings } = await supabase.from("site_settings").select("theme").eq("id", "global").maybeSingle();
  const theme = resolveTheme(settings?.theme);
  const name = profile.full_name || identity.fullName || identity.email;

  return (
    <div className="theme-root" data-theme={theme}>
      <AppShell name={name} email={identity.email} role={profile.role}>
        {children}
      </AppShell>
    </div>
  );
}

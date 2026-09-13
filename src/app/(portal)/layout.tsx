import { AppShell } from "@/components/app-shell";
import { requireActiveProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { customPaletteStyle, resolveTheme, validPaletteTokens } from "@/lib/theme";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { identity, profile } = await requireActiveProfile();
  const supabase = await createClient();
  const { data: settings } = await supabase.from("site_settings").select("theme,active_custom_slot").eq("id", "global").maybeSingle();
  const theme = resolveTheme(settings?.theme);
  const paletteResult = settings?.active_custom_slot ? await supabase.from("site_custom_palettes").select("tokens").eq("slot",settings.active_custom_slot).maybeSingle() : null;
  const tokens = validPaletteTokens(paletteResult?.data?.tokens) ? paletteResult.data.tokens : null;
  const name = profile.full_name || identity.fullName || identity.email;

  return (
    <div className="theme-root" data-theme={theme} data-custom-palette={tokens ? "active" : undefined} style={customPaletteStyle(tokens)}>
      <AppShell name={name} email={identity.email} role={profile.role} profileId={identity.id} avatarVersion={profile.updated_at}>
        {children}
      </AppShell>
    </div>
  );
}

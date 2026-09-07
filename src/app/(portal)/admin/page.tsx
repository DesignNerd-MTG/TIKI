import type { Metadata } from "next";
import { Check, ShieldCheck, Users } from "lucide-react";

import { AppearanceSettings } from "@/components/appearance-settings";
import { DatabaseNotice, EmptyState, PageHeader } from "@/components/ui";
import { roleLabel } from "@/lib/access";
import { requireActiveProfile } from "@/lib/auth";
import { formatDate, initials } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { roles, type AppRole, type Profile } from "@/lib/types";
import { resolveTheme } from "@/lib/theme";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await requireActiveProfile("admin");
  const [params, supabase] = await Promise.all([searchParams, createClient()]);
  const [{ data, error }, { data: settings }] = await Promise.all([
    supabase.from("profiles").select("id,email,full_name,avatar_url,role,active,created_at,updated_at").order("active").order("created_at", { ascending: false }),
    supabase.from("site_settings").select("theme").eq("id", "global").maybeSingle(),
  ]);
  const profiles = (data ?? []) as Profile[];
  const activeCount = profiles.filter((profile) => profile.active).length;
  const pendingCount = profiles.length - activeCount;
  const errorMessage = params.error === "self-lockout"
    ? "T.I.K.I. prevented you from deactivating or demoting your own admin session."
    : params.error === "validation"
      ? "The requested role or profile was invalid."
      : "The profile could not be updated.";

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Administration" title="People & access" description="Supabase confirms identity; administrators activate each person and decide what T.I.K.I. lets them do." action={<span className="restricted-badge"><ShieldCheck size={15} /> Admin only</span>} />
      {params.saved && <div className="notice notice--success"><Check size={18} /> Access profile updated.</div>}
      {params.error && <div className="notice notice--error">{errorMessage}</div>}
      <AppearanceSettings currentTheme={resolveTheme(settings?.theme)} />
      {!error && <div className="admin-summary" aria-label="Access summary"><span><strong>{activeCount}</strong> active</span><span><strong>{pendingCount}</strong> pending</span><span><strong>{profiles.length}</strong> total</span></div>}
      {error ? <DatabaseNotice /> : profiles.length ? (
        <div className="admin-list">
          {profiles.map((profile) => (
            <article className="admin-user" key={profile.id}>
              <div className="avatar avatar--light">{initials(profile.full_name || profile.email)}</div>
              <div className="admin-user__identity">
                <strong>{profile.full_name || profile.email.split("@")[0]}</strong>
                <span>{profile.email}</span>
                <small>Joined {formatDate(profile.created_at)}</small>
              </div>
              <form className="admin-user__controls" action="/admin/users/update" method="post" aria-label={`Access settings for ${profile.full_name || profile.email}`}>
                <input type="hidden" name="id" value={profile.id} />
                <label>
                  <span>Role</span>
                  <select name="role" defaultValue={profile.role}>
                    {roles.map((role: AppRole) => <option value={role} key={role}>{roleLabel(role)}</option>)}
                  </select>
                </label>
                <label className="switch-control">
                  <input type="checkbox" name="active" value="true" defaultChecked={profile.active} />
                  <span>Active</span>
                </label>
                <button className="secondary-button" type="submit">Save</button>
              </form>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon={Users} title="No profiles found" description="Profiles are created automatically when someone creates an account." />
      )}
    </div>
  );
}

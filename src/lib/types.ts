export const roles = ["viewer", "contributor", "editor", "admin"] as const;

export type AppRole = (typeof roles)[number];

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: AppRole;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type Identity = {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
};

export type AccessContext = {
  identity: Identity;
  profile: Profile;
};

export type ContentStatus =
  | "draft"
  | "submitted"
  | "verified"
  | "published"
  | "archived";

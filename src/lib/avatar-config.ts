export const avatarBucket = "tiki-avatars";
export const avatarLimit = 2 * 1024 * 1024;
export const avatarTypes = ["image/jpeg", "image/png", "image/webp"];
export const avatarPath = (id: string) => `${id}/avatar.webp`;

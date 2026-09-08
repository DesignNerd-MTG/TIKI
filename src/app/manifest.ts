import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "T.I.K.I. — Technical Information & Knowledge Index",
    short_name: "T.I.K.I.",
    description: "LDG Entertainment Division’s private technical knowledge portal.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#101d25",
    theme_color: "#101d25",
    icons: [{ src: "/tiki-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}

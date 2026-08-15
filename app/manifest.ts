import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nasir Bespoke Virtual Try-On",
    short_name: "Nasir Try-On",
    description: "Private Nasir Bespoke virtual garment try-on tool.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f3ed",
    theme_color: "#171714",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ReadingStar Planet",
    short_name: "ReadingStar",
    description:
      "A kid-friendly reading assistant with focus reading, letter helpers, and text-to-speech.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFF9F0",
    theme_color: "#FF8C42",
    icons: [
      {
        src: "/icon?size=192",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon?size=512",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
import { Frijole } from "next/font/google";

const frijole = Frijole({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const HOME_TITLE_THEME = {
  className: frijole.className,
  fontSize: "clamp(14px, 1.42vw, 22px)",
  letterSpacing: "0.03em",
  lineHeight: 1.14,
  baseColor: "rgba(232, 226, 205, 0.68)",
  shadow: "0 1px 8px rgba(52, 42, 20, 0.18)",
  transformPattern: ["translateY(0px)", "translateY(-1px)", "translateY(1px)"],
} as const;
import type { Metadata } from "next";
/* eslint-disable @next/next/no-page-custom-font */
import { headers } from "next/headers";
import { BUSINESS } from "@/lib/business";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://nobre-barber-club.felipe123guideroli.chatgpt.site"),
  title: { default: `${BUSINESS.name} — Barbearia em ${BUSINESS.neighborhood}`, template: `%s — ${BUSINESS.shortName}` },
  description: "Barbearia editorial em Pinheiros, São Paulo. Cortes autorais, barba, fade e atendimento com hora marcada.",
  applicationName: BUSINESS.name,
  keywords: ["barbearia em Pinheiros", "barbearia São Paulo", "corte masculino", "fade", "barba"],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: BUSINESS.name,
    title: `${BUSINESS.name} — Corte é linguagem`,
    description: "Cortes autorais, barba e uma experiência de grooming com hora marcada em Pinheiros.",
  },
  twitter: { card: "summary", title: `${BUSINESS.name} — Corte é linguagem`, description: "Barbearia editorial em Pinheiros, São Paulo." },
  robots: { index: true, follow: true },
};

const localBusiness = {
  "@context": "https://schema.org",
  "@type": "HairSalon",
  name: BUSINESS.name,
  description: "Barbearia autoral com cortes masculinos, fade e ritual de barba.",
  telephone: `+55 ${BUSINESS.phoneDisplay}`,
  priceRange: "$$",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Rua dos Pinheiros, 1188",
    addressLocality: "São Paulo",
    addressRegion: "SP",
    addressCountry: "BR",
  },
  openingHoursSpecification: [
    { "@type": "OpeningHoursSpecification", dayOfWeek: ["Tuesday", "Wednesday", "Thursday", "Friday"], opens: "09:00", closes: "20:00" },
    { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "08:00", closes: "18:00" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400;6..96,500;6..96,600&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
        <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusiness).replace(/</g, "\\u003c") }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

// DADOS EDITÁVEIS DA BARBEARIA — substitua estes exemplos antes do lançamento público.
export const BUSINESS = {
  name: "Nobre Barber Club",
  shortName: "Nobre",
  slogan: "Corte é linguagem.",
  city: "São Paulo — SP",
  neighborhood: "Pinheiros",
  address: "Rua dos Pinheiros, 1188 — Pinheiros, São Paulo — SP",
  phoneDisplay: "(11) 99999-9999",
  whatsappE164: "5511999999999",
  instagram: "@nobrebarberclub",
  instagramUrl: "https://www.instagram.com/",
  mapsUrl: "https://www.google.com/maps?q=Rua+dos+Pinheiros+1188+Sao+Paulo&output=embed",
  openingHours: [
    { label: "Terça — sexta", value: "09:00 — 20:00" },
    { label: "Sábado", value: "08:00 — 18:00" },
    { label: "Domingo e segunda", value: "Fechado" },
  ],
  founded: 2019,
} as const;

export function whatsappUrl(message = "Olá! Conheci a Nobre pelo site e gostaria de falar sobre um horário."): string {
  return `https://wa.me/${BUSINESS.whatsappE164}?text=${encodeURIComponent(message)}`;
}

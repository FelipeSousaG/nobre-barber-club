export type Service = {
  id: string;
  slug: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
  active: boolean;
};

export type Barber = {
  id: string;
  slug: string;
  name: string;
  bio: string;
  specialty: string;
  photoUrl: string;
  yearsExperience: number;
  favoriteStyles: string;
  workDays: number[];
  rating: number;
  active: boolean;
  availability: string;
};

export type Look = {
  id: string;
  category: "Fade" | "Classic" | "Beard" | "Modern" | "Texture";
  name: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  serviceSlug: string;
  barberId: string;
};

export type Profile = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  emailVerifiedAt: string | null;
  role: "client" | "admin";
  createdAt: string;
  updatedAt: string;
};

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: "client" | "admin";
};

// App-wide constants (room types, production stage order, admin/viewer
// emails, furniture catalog options). Extracted from App.tsx.

export const ROOM_TYPES = [
  {
    key: "bedroom",
    ar: "غرفة نوم",
    en: "Bedroom",
    defaults: [
      "سرير",
      "كومود",
      "دولاب",
      "تسريحة",
      "شيفونيرة",
      "شماعة",
      "كرسي/بف",
    ],
  },
  {
    key: "dining",
    ar: "سفرة",
    en: "Dining room",
    defaults: ["كرسي", "سفرة", "بوفيه", "نيش"],
  },
  {
    key: "kids",
    ar: "أطفال",
    en: "Kids room",
    defaults: [
      "سرير",
      "كومود",
      "دولاب",
      "تسريحة",
      "شيفونيرة",
      "شماعة",
      "كرسي/بف",
      "مكتب",
    ],
  },
  {
    key: "salon",
    ar: "صالون",
    en: "Salon",
    defaults: ["كنبة كبيرة", "كنبة صغيرة", "كرسي", "كُوفي تيبل"],
  },
  {
    key: "antrei",
    ar: "أنتريه",
    en: "Antrei",
    defaults: ["كنبة كبيرة", "كنبة صغيرة", "كرسي", "كُوفي تيبل"],
  },
  {
    key: "other",
    ar: "أخرى",
    en: "Other",
    defaults: ["مكتب", "مكتبة", "تي في يونيت"],
  },
] as const;

export const STAGE_ORDER = [
  { key: "received", ar: "استلام", en: "Received" },
  { key: "carpentry", ar: "نجارة", en: "Carpentry" },
  { key: "finishing", ar: "تشطيب", en: "Finishing" },
  { key: "painting", ar: "دهان", en: "Painting" },
  { key: "upholstery", ar: "تنجيد", en: "Upholstery" },
  { key: "delivery", ar: "تسليم", en: "Delivery" },
] as const;

export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@gmail.com") as string;
export const VIEWER_EMAIL = (process.env.VIEWER_EMAIL || "view@gmail.com") as string;

export const FURNITURE_OPTIONS = [
  "سرير كبير",
  "دولاب",
  "كومود",
  "سراحة",
  "شفونيرة",
  "سرير أطفال",
  "دولاب أطفال",
  "كومود أطفال",
  "ترابيزة سفرة",
  "كرسي سفرة",
  "بوفيه",
  "نيش",
  "مطبخ",
  "كنبة",
  "ركنة",
  "صالون",
];
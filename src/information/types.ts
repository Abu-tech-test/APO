export type CostumeInfo = {
  name: string;
  appearanceMonster: string;
  description?: string;
  items: { amount: string; name: string; note?: string }[];
  reward?: string;
};

export type InformationCategory = {
  name: string;
  kind: string;
  stages?: string[][];
  gains?: string[][];
  trivia?: { name: string; clientId: number; subType: number; desc: string };
  professions?: Record<
    string,
    {
      name: string;
      spells: string[][];
      soul: string[][];
    }
  >;
  commands?: string[][];
  links?: { name: string; info: string; url: string }[];
  rules?: string[];
  entries?: CostumeInfo[];
};

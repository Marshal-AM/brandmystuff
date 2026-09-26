/** Fast-demo helpers: sample photos and prefilled example text. Turn off with NEXT_PUBLIC_DEMO_SUBMIT=0. */
export const DEMO_ENABLED = process.env.NEXT_PUBLIC_DEMO_SUBMIT !== "0";

const FILES = { hero: "hero.jpg", space: "space.jpg", proof: "proof.jpg", kyc: "id.jpg", logo: "logo.png" } as const;
export type DemoAsset = keyof typeof FILES;

/** Loads a bundled sample image as a File. */
export async function demoFile(kind: DemoAsset): Promise<File> {
  const name = FILES[kind];
  const res = await fetch(`/demo/${name}`);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || (name.endsWith(".png") ? "image/png" : "image/jpeg") });
}

/** Example values that prefill forms so a demo can move quickly. Everything stays editable. */
export const DEMO = {
  handle: () => `maya-${Math.random().toString(36).slice(2, 6)}`,
  displayName: "Maya Chen",
  brandName: "",
  brand: { name: "Lumen Coffee Co.", about: "Small-batch specialty coffee for people who love slow mornings and a good desk ritual. Warm, calm and a little playful.", location: "Bengaluru, India" },
  object: { title: "My MacBook Pro 14", make: "Apple", model: "MacBook Pro 14, space grey", city: "Tokyo", description: "Space grey 14-inch MacBook Pro I carry to cafés, coworking spaces and meetups every day. Hundreds of people see the lid each week." },
  space: { label: "lid-center", widthCm: "18", heightCm: "12", material: "anodised aluminium" },
  profile: { bio: "Designer and student in Tokyo. My laptop lid goes everywhere I do.", twitter: "mayachen", website: "https://example.com" },
  kyc: { legalName: "Maya Chen", dateOfBirth: "1995-01-01", country: "IN", addressLine: "12 MG Road, Bengaluru 560001" },
  lease: { brand: "Lumen Coffee Co.", landingUrl: "https://example.com/lumen" },
  message: "Hi! We'd love to put our logo on this space for a couple of weeks. Does that work for you?",
};

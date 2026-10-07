import { z } from "zod";

const licensed = {
  license: z.string().min(1),
  source_url: z.url(),
  attribution: z.string().min(1),
};

export const AssetEntry = z.object({
  id: z.string().min(1),
  kind: z.enum(["model", "texture", "marker", "image"]),
  file: z.string().min(1),
  ...licensed,
  review_status: z.enum(["needs_review", "reviewed"]),
});

export const AssetManifest = z.object({
  schemaVersion: z.literal(1),
  assets: z.array(AssetEntry),
  thirdPartyUi: z.array(z.object({ name: z.string().min(1), package: z.string().min(1), ...licensed })),
});

export type AssetManifest = z.infer<typeof AssetManifest>;

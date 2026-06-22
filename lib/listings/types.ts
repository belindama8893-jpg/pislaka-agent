import { z } from "zod";

export const listingDraftInputSchema = z.object({
  conversation_id: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  city: z.string().default("Lahore"),
  location_area: z.string().optional(),
  property_type: z.string().optional(),
  listing_type: z.enum(["sale", "rent"]).optional(),
  price_amount: z.number().positive().optional(),
  price_currency: z.string().default("PKR"),
  area_value: z.number().positive().optional(),
  area_unit: z.enum(["kanal", "marla", "sqft", "sqm"]).optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  features: z.array(z.string()).default([]),
  ai_extracted_payload: z.record(z.unknown()).optional(),
  ai_confidence: z.number().min(0).max(1).optional()
});

export type ListingDraftInput = z.infer<typeof listingDraftInputSchema>;

export const listingDraftUpdateSchema = listingDraftInputSchema
  .partial()
  .extend({
    id: z.string().uuid(),
    status: z.enum(["draft", "published", "archived"]).optional()
  })
  .refine((value) => Object.keys(value).some((key) => key !== "id"), {
    message: "At least one listing field must be provided"
  });

export type ListingDraftUpdateInput = z.infer<typeof listingDraftUpdateSchema>;

export const listingDeleteSchema = z.object({
  id: z.string().uuid()
});

export type ListingMediaRecord = {
  id: string;
  listing_id: string;
  media_type: "image" | "video";
  storage_url: string;
  sort_order: number;
  created_at: string;
  signed_url?: string | null;
};

export type ListingRecord = {
  id: string;
  status: "draft" | "published" | "archived";
  title: string | null;
  description: string | null;
  city: string | null;
  location_area: string | null;
  property_type: string | null;
  listing_type: "sale" | "rent" | null;
  price_amount: number | null;
  price_currency: string | null;
  area_value: number | null;
  area_unit: "kanal" | "marla" | "sqft" | "sqm" | null;
  bedrooms: number | null;
  bathrooms: number | null;
  features: string[] | null;
  created_at: string;
  updated_at: string | null;
  media?: ListingMediaRecord[];
};

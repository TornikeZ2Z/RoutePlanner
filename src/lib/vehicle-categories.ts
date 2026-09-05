import type { MessageKey } from "@/lib/i18n";

/**
 * Body types, offered before the search rather than after it.
 *
 * CR-2026-0008 item 5: a traveller who is shown a specific car should know
 * what kind of car it is before they look at prices. The seat range is part
 * of the label on purpose — it is the only thing that lets someone who has
 * never hired a minivan tell it from a minibus, which is exactly the
 * objection CLASS_TIERS in offer-filters.tsx was written to answer. Tiers
 * sort by price and these sort by size; both expand into the same six
 * `vehicle_class` values the price bands use, and neither invents a seventh.
 *
 * `maxPassengers` is what the label promises, not what the fleet holds — it
 * only exists so the form can refuse a search that could not be fulfilled
 * before it costs the traveller a page load. The database still decides which
 * cars actually fit.
 *
 * Kept out of offer-filters.tsx because the booking bar is a client
 * component, and importing that module would drag the filter panel, its Card
 * and its translator into the bundle every visitor downloads.
 */
export const VEHICLE_CATEGORIES: {
  id: string;
  label: MessageKey;
  maxPassengers: number;
  classes: string[];
}[] = [
  // A saloon is a saloon whether it is sold as economy, comfort or premium;
  // price sorts those three, size does not.
  { id: "sedan", label: "search.vehSedan", maxPassengers: 3, classes: ["ECONOMY", "COMFORT", "PREMIUM"] },
  { id: "suv", label: "search.vehSuv", maxPassengers: 4, classes: ["SUV_4X4"] },
  { id: "minivan", label: "search.vehMinivan", maxPassengers: 7, classes: ["MINIVAN"] },
  // The open end of the range. The passenger field stops at 20 anyway.
  { id: "minibus", label: "search.vehMinibus", maxPassengers: 20, classes: ["MINIBUS"] },
];

/** The classes a category covers, or none at all for "any vehicle". */
export function classesForCategory(id: string | undefined): string[] {
  return VEHICLE_CATEGORIES.find((c) => c.id === id)?.classes ?? [];
}

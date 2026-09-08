/**
 * The Explore Georgia map's curated content layer.
 *
 * Which pins exist, what they are (categories), when they shine (seasons),
 * and which sub-places their card mentions — the founder's editorial
 * judgement as data. A location missing from this table simply does not
 * appear on the map, even if it is bookable; the map is a recommendation,
 * not an inventory dump.
 */
export type MapCategory = "sea" | "mountains" | "winter" | "wine" | "culture" | "nature";
export type Season = "spring" | "summer" | "autumn" | "winter";

export interface Destination {
  slug: string;
  categories: MapCategory[];
  seasons: Season[];
  /** Dictionary key for the one-sentence card description. */
  descKey: string;
  /** Which category's icon marks the pin. */
  icon: MapCategory;
  /** Where the label sits relative to the pin when neighbours crowd. */
  labelPos?: "top" | "bottom" | "left" | "right";
  /** Small pixel nudge for the whole pin when two pins collide. */
  dx?: number;
  dy?: number;
}

/**
 * Sights: the things you go and look at once you have arrived somewhere.
 *
 * CR-2026-0036 arrived as one list of about eighty place names to add to
 * "where do you want to go". A good third of them are not places you travel to
 * and stay — Svetitskhoveli is a cathedral inside Mtskheta, Ushba is a mountain
 * you look at from Mestia, Gergeti Trinity is the church above Stepantsminda.
 * Giving each of those its own destination page, titled "how to get there and
 * what it costs", would have been wrong twice over: it is not a destination,
 * and we do not sell a journey to it.
 *
 * So they attach to the destination they belong to. That is the answer both to
 * this ticket and to CR-2026-0010 item 14, which has asked for "main sights" on
 * every destination page since 4 September and was blocked because no such data
 * existed anywhere. It does now.
 *
 * A sight needs no location row, no coordinates and no page: it is a name and a
 * parent. Anything that genuinely is somewhere you can be driven to and stay
 * belongs in DESTINATIONS below instead.
 */
export interface Sight {
  /** Stable key, used for the dictionary lookup. */
  slug: string;
  /** The destination slug this belongs to. Must exist in DESTINATIONS. */
  destination: string;
}

export const SIGHTS: Sight[] = [
  // Kazbegi / Mtiuleti
  { slug: "gergeti",      destination: "kazbegi" },
  { slug: "dariali",      destination: "kazbegi" },
  { slug: "truso",        destination: "kazbegi" },
  { slug: "gveleti",      destination: "kazbegi" },
  { slug: "mkinvartsveri", destination: "kazbegi" },
  { slug: "juta",         destination: "kazbegi" },
  { slug: "sno",          destination: "kazbegi" },

  // Svaneti
  { slug: "ushguli",      destination: "mestia" },
  { slug: "ushba",        destination: "mestia" },
  { slug: "tetnuldi",     destination: "mestia" },
  { slug: "hatsvali",     destination: "mestia" },

  // Mtskheta
  { slug: "svetitskhoveli", destination: "mtskheta" },
  { slug: "jvari",        destination: "mtskheta" },
  { slug: "samtavro",     destination: "mtskheta" },
  { slug: "shiomghvime",  destination: "mtskheta" },

  // Imereti, from Kutaisi
  { slug: "gelati",       destination: "kutaisi" },
  { slug: "motsameta",    destination: "kutaisi" },
  { slug: "prometheus",   destination: "kutaisi" },
  { slug: "sataplia",     destination: "kutaisi" },

  // Racha
  { slug: "nikortsminda", destination: "ambrolauri" },
  { slug: "barakoni",     destination: "ambrolauri" },
  { slug: "shovi",        destination: "oni" },

  // Adjara, from Batumi
  { slug: "gonio",        destination: "batumi" },
  { slug: "mtsvanekontskhi", destination: "batumi" },
];

/** The sights that belong to a destination, in the order they are listed. */
export const sightsFor = (destination: string): Sight[] =>
  SIGHTS.filter((s) => s.destination === destination);

export const DESTINATIONS: Destination[] = [
  { slug: "tbilisi",     categories: ["culture"],                       seasons: ["spring", "summer", "autumn", "winter"], descKey: "map.d.tbilisi",     icon: "culture", labelPos: "right" },
  { slug: "mtskheta",    categories: ["culture"],                       seasons: ["spring", "summer", "autumn"],           descKey: "map.d.mtskheta",    icon: "culture", labelPos: "left" },
  { slug: "kazbegi",     categories: ["mountains", "nature"],           seasons: ["spring", "summer", "autumn"],           descKey: "map.d.kazbegi",     icon: "mountains" },
  { slug: "gudauri",     categories: ["mountains", "winter"],           seasons: ["winter"],                               descKey: "map.d.gudauri",     icon: "winter", labelPos: "bottom" },
  { slug: "mestia",      categories: ["mountains", "nature", "winter"], seasons: ["summer", "winter"],                     descKey: "map.d.mestia",      icon: "mountains" },
  { slug: "batumi",      categories: ["sea", "culture"],                seasons: ["summer"],                               descKey: "map.d.batumi",      icon: "sea", labelPos: "left" },
  { slug: "kutaisi",     categories: ["culture", "nature"],             seasons: ["spring", "summer", "autumn"],           descKey: "map.d.kutaisi",     icon: "culture" },
  { slug: "telavi",      categories: ["wine", "culture"],               seasons: ["autumn", "spring", "summer"],           descKey: "map.d.telavi",      icon: "wine", labelPos: "left" },
  { slug: "sighnaghi",   categories: ["wine", "culture"],               seasons: ["autumn", "spring", "summer"],           descKey: "map.d.sighnaghi",   icon: "wine", labelPos: "bottom" },
  { slug: "borjomi",     categories: ["nature", "culture"],             seasons: ["spring", "summer", "autumn"],           descKey: "map.d.borjomi",     icon: "nature", labelPos: "left" },
  { slug: "vardzia",     categories: ["culture"],                       seasons: ["spring", "summer", "autumn"],           descKey: "map.d.vardzia",     icon: "culture", labelPos: "bottom" },
  // --- the founder's additions -------------------------------------------
  { slug: "bakhmaro",    categories: ["mountains", "nature"],           seasons: ["summer", "winter"],                     descKey: "map.d.bakhmaro",    icon: "mountains" },
  { slug: "shekvetili",  categories: ["sea", "nature"],                 seasons: ["summer"],                               descKey: "map.d.shekvetili",  icon: "sea", labelPos: "left" },
  { slug: "ureki",       categories: ["sea"],                           seasons: ["summer"],                               descKey: "map.d.ureki",       icon: "sea", labelPos: "left", dy: -8 },
  { slug: "ambrolauri",  categories: ["wine", "nature", "culture"],     seasons: ["spring", "summer", "autumn"],           descKey: "map.d.ambrolauri",  icon: "wine" },
  { slug: "oni",         categories: ["nature", "culture"],             seasons: ["summer", "autumn"],                     descKey: "map.d.oni",         icon: "nature" },
  { slug: "martvili",    categories: ["nature"],                        seasons: ["spring", "summer", "autumn"],           descKey: "map.d.martvili",    icon: "nature" },
  { slug: "zugdidi",     categories: ["culture"],                       seasons: ["spring", "summer", "autumn"],           descKey: "map.d.zugdidi",     icon: "culture" },
  { slug: "bakuriani",   categories: ["winter", "mountains", "nature"], seasons: ["winter", "summer"],                     descKey: "map.d.bakuriani",   icon: "winter", labelPos: "right", dx: 6, dy: 6 },
  { slug: "akhaltsikhe", categories: ["culture"],                       seasons: ["spring", "summer", "autumn"],           descKey: "map.d.akhaltsikhe", icon: "culture", labelPos: "bottom", dx: 8, dy: 8 },
  { slug: "abastumani",  categories: ["nature"],                        seasons: ["summer", "autumn"],                     descKey: "map.d.abastumani",  icon: "nature", labelPos: "bottom", dx: -4, dy: -14 },
  { slug: "kvareli",     categories: ["wine"],                          seasons: ["autumn", "spring", "summer"],           descKey: "map.d.kvareli",     icon: "wine", labelPos: "right" },
  { slug: "tsinandali",  categories: ["wine", "culture"],               seasons: ["autumn", "spring", "summer"],           descKey: "map.d.tsinandali",  icon: "wine", labelPos: "top", dy: -6 },

  /*
     CR-2026-0018 named nineteen destinations the site should cover. These four
     were the ones it did not have at all.

     Their location rows (migration 0021) are in_service_area = false, so they
     have pages and appear on the destinations index, but do not offer
     themselves in the booking fields. Three are 4x4-only mountain road, two of
     those for about four months a year, and none has a route family to price
     against. The seasons below say so honestly rather than optimistically:
     Tusheti and Khevsureti are summer only because the passes are shut the rest
     of the year.
  */
  { slug: "okatse",      categories: ["nature"],                        seasons: ["spring", "summer", "autumn"],           descKey: "map.d.okatse",      icon: "nature", labelPos: "top", dy: -6 },
  { slug: "tusheti",     categories: ["mountains", "nature"],           seasons: ["summer"],                               descKey: "map.d.tusheti",     icon: "mountains", labelPos: "right" },
  { slug: "khevsureti",  categories: ["mountains", "nature"],           seasons: ["summer"],                               descKey: "map.d.khevsureti",  icon: "mountains", labelPos: "top", dy: -8 },
  { slug: "goderdzi",    categories: ["winter", "mountains"],           seasons: ["winter", "summer"],                     descKey: "map.d.goderdzi",    icon: "winter", labelPos: "bottom" },
];

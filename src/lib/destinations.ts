/**
 * The curated content layer under every destination page.
 *
 * Which places exist, what they are (categories), when they shine (seasons),
 * which province they belong to, how long to give them, what the road demands,
 * what there is to see once you arrive, what is worth stopping at on the way,
 * and what the local kitchen is known for — the founder's editorial judgement
 * as data. A location missing from this table has no page, even if it is
 * bookable; this is a recommendation, not an inventory dump.
 */
export type MapCategory = "sea" | "mountains" | "winter" | "wine" | "culture" | "nature";
export type Season = "spring" | "summer" | "autumn" | "winter";

/**
 * Historic provinces, not administrative regions.
 *
 * CR-2026-0036 asked for the places to be grouped "by region" and gave its own
 * example — "in Guria, Bakhmaro and Gomis Mta". Guria is a province, not a
 * mkhare, and so is every other name a traveller uses: nobody plans a trip to
 * Samegrelo-Zemo Svaneti, they go to Svaneti. The provinces also carry the
 * cooking, which is the other thing CR-2026-0036 asked for, so one axis serves
 * both: Mestia is in Svaneti for the grouping AND for the kubdari.
 */
export type Region =
  | "tbilisi" | "kartli" | "khevi" | "khevsureti" | "tusheti" | "kakheti"
  | "imereti" | "racha" | "samegrelo" | "svaneti" | "guria" | "adjara" | "samtskhe";

/** Provinces in the order they are shown wherever places are grouped. */
export const REGIONS: Region[] = [
  "tbilisi", "kartli", "kakheti", "khevi", "khevsureti", "tusheti",
  "imereti", "racha", "samegrelo", "svaneti", "guria", "adjara", "samtskhe",
];

/**
 * What the road asks of the car, which is the honest form of "suitable
 * vehicles" (CR-2026-0010 item 14).
 *
 * Not a free list of classes per place: the constraint is the road, and one
 * road fact generates the same answer every time. "offroad" is the same
 * condition route_families records as requires_4x4 — Tusheti's Abano pass is
 * not a road a saloon car should be sent up, and saying so is the point.
 */
export type RoadFit = "paved" | "mountain" | "offroad";

export interface Destination {
  slug: string;
  categories: MapCategory[];
  seasons: Season[];
  /** Dictionary key for the one-sentence card description. */
  descKey: string;
  /** Which category's icon marks the pin. */
  icon: MapCategory;
  /** Historic province — grouping on the home page, and the local kitchen. */
  region: Region;
  /** How many days to give it: [fewest worth it, comfortable]. */
  days: [number, number];
  /** What the road demands of the car. */
  road: RoadFit;
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
 *
 * A slug may appear more than once. Gonio fortress is a sight of Batumi and of
 * Kvariati, which is four kilometres from it; the name is written once and the
 * two pages both show it.
 */
export interface Sight {
  /** Stable key, used for the dictionary lookup. */
  slug: string;
  /** The destination slug this belongs to. Must exist in DESTINATIONS. */
  destination: string;
}

export const SIGHTS: Sight[] = [
  { slug: "narikala",            destination: "tbilisi"        },
  { slug: "abanotubani",         destination: "tbilisi"        },
  { slug: "davitgareja",         destination: "tbilisi"        },
  { slug: "dmanisi",             destination: "tbilisi"        },
  { slug: "tbilisinp",           destination: "tbilisi"        },
  { slug: "svetitskhoveli",      destination: "mtskheta"       },
  { slug: "jvari",               destination: "mtskheta"       },
  { slug: "samtavro",            destination: "mtskheta"       },
  { slug: "shiomghvime",         destination: "mtskheta"       },
  { slug: "gergeti",             destination: "kazbegi"        },
  { slug: "mkinvartsveri",       destination: "kazbegi"        },
  { slug: "dariali",             destination: "kazbegi"        },
  { slug: "truso",               destination: "kazbegi"        },
  { slug: "gveleti",             destination: "kazbegi"        },
  { slug: "juta",                destination: "kazbegi"        },
  { slug: "sno",                 destination: "kazbegi"        },
  { slug: "kazbeginp",           destination: "kazbegi"        },
  { slug: "friendship",          destination: "gudauri"        },
  { slug: "jvaripass",           destination: "gudauri"        },
  { slug: "ushguli",             destination: "mestia"         },
  { slug: "ushba",               destination: "mestia"         },
  { slug: "tetnuldi",            destination: "mestia"         },
  { slug: "hatsvali",            destination: "mestia"         },
  { slug: "latali",              destination: "mestia"         },
  { slug: "lenjeri",             destination: "mestia"         },
  { slug: "ipari",               destination: "mestia"         },
  { slug: "kala",                destination: "mestia"         },
  { slug: "batumiboulevard",     destination: "batumi"         },
  { slug: "mtsvanekontskhi",     destination: "batumi"         },
  { slug: "gonio",               destination: "batumi"         },
  { slug: "mtirala",             destination: "batumi"         },
  { slug: "gelati",              destination: "kutaisi"        },
  { slug: "bagrati",             destination: "kutaisi"        },
  { slug: "motsameta",           destination: "kutaisi"        },
  { slug: "prometheus",          destination: "kutaisi"        },
  { slug: "sataplia",            destination: "kutaisi"        },
  { slug: "batonistsikhe",       destination: "telavi"         },
  { slug: "alaverdi",            destination: "telavi"         },
  { slug: "ikalto",              destination: "telavi"         },
  { slug: "shuamta",             destination: "telavi"         },
  { slug: "lopota",              destination: "telavi"         },
  { slug: "bodbe",               destination: "sighnaghi"      },
  { slug: "sighnaghiwalls",      destination: "sighnaghi"      },
  { slug: "vashlovani",          destination: "sighnaghi"      },
  { slug: "borjomipark",         destination: "borjomi"        },
  { slug: "borjomikharagauli",   destination: "borjomi"        },
  { slug: "khertvisi",           destination: "vardzia"        },
  { slug: "tmogvi",              destination: "vardzia"        },
  { slug: "gomismta",            destination: "bakhmaro"       },
  { slug: "dendrological",       destination: "shekvetili"     },
  { slug: "tsitsinatela",        destination: "shekvetili"     },
  { slug: "magneticbeach",       destination: "ureki"          },
  { slug: "nikortsminda",        destination: "ambrolauri"     },
  { slug: "barakoni",            destination: "ambrolauri"     },
  { slug: "khotevi",             destination: "ambrolauri"     },
  { slug: "shaori",              destination: "ambrolauri"     },
  { slug: "khvanchkara",         destination: "ambrolauri"     },
  { slug: "shovi",               destination: "oni"            },
  { slug: "onisynagogue",        destination: "oni"            },
  { slug: "utsera",              destination: "oni"            },
  { slug: "balda",               destination: "martvili"       },
  { slug: "tobavarchkhili",      destination: "martvili"       },
  { slug: "dadiani",             destination: "zugdidi"        },
  { slug: "didveli",             destination: "bakuriani"      },
  { slug: "mtsvanetba",          destination: "bakuriani"      },
  { slug: "rabati",              destination: "akhaltsikhe"    },
  { slug: "sapara",              destination: "akhaltsikhe"    },
  { slug: "javakheti",           destination: "akhaltsikhe"    },
  { slug: "observatory",         destination: "abastumani"     },
  { slug: "winetunnel",          destination: "kvareli"        },
  { slug: "kvarelilake",         destination: "kvareli"        },
  { slug: "nekresi",             destination: "kvareli"        },
  { slug: "gremi",               destination: "kvareli"        },
  { slug: "chavchavadze",        destination: "tsinandali"     },
  { slug: "kinchkha",            destination: "okatse"         },
  { slug: "omalo",               destination: "tusheti"        },
  { slug: "dartlo",              destination: "tusheti"        },
  { slug: "diklo",               destination: "tusheti"        },
  { slug: "shenako",             destination: "tusheti"        },
  { slug: "parsma",              destination: "tusheti"        },
  { slug: "abano",               destination: "tusheti"        },
  { slug: "shatili",             destination: "khevsureti"     },
  { slug: "mutso",               destination: "khevsureti"     },
  { slug: "roshka",              destination: "khevsureti"     },
  { slug: "abudelauri",          destination: "khevsureti"     },
  { slug: "beshumi",             destination: "goderdzi"       },
  { slug: "goderdziforest",      destination: "goderdzi"       },
  { slug: "kintrishi",           destination: "kobuleti"       },
  { slug: "kobuletiwetlands",    destination: "kobuleti"       },
  { slug: "chakvitea",           destination: "chakvi"         },
  { slug: "mtsvanekontskhi",     destination: "chakvi"         },
  { slug: "petra",               destination: "tsikhisdziri"   },
  { slug: "batumiboulevard",     destination: "makhinjauri"    },
  { slug: "gonio",               destination: "kvariati"       },
  { slug: "gonio",               destination: "sarpi"          },
  { slug: "kolkheti",            destination: "grigoleti"      },
  { slug: "magneticbeach",       destination: "grigoleti"      },
  { slug: "khuloropeway",        destination: "khulo"          },
  { slug: "skhalta",             destination: "khulo"          },
  { slug: "beshumi",             destination: "khulo"          },
  { slug: "uplistsikhe",         destination: "gori"           },
  { slug: "gorifortress",        destination: "gori"           },
  { slug: "stalinmuseum",        destination: "gori"           },
  { slug: "atenisioni",          destination: "gori"           },
  { slug: "tskaltubobaths",      destination: "tskaltubo"      },
  { slug: "prometheus",          destination: "tskaltubo"      },
  { slug: "sataplia",            destination: "tskaltubo"      },
  { slug: "lagodekhipa",         destination: "lagodekhi"      },
  { slug: "ninoskhevi",          destination: "lagodekhi"      },
];

/**
 * Stops: what is worth pulling over for on the way there.
 *
 * The other half of CR-2026-0010 item 14, and the half that only makes sense
 * for a driver: a bus does not stop at Ananuri, and this is the difference
 * between hiring a car and buying a seat. The list is written from Tbilisi
 * outward, because that is where almost every journey starts.
 *
 * Same shape as SIGHTS, and the same reuse: Keda and the Makhuntseti bridge are
 * on the road to Khulo and on the road to Goderdzi, so both pages list them.
 */
export const STOPS: Sight[] = [
  { slug: "ananuri",             destination: "kazbegi"        },
  { slug: "pasanauri",           destination: "kazbegi"        },
  { slug: "gudauriarch",         destination: "kazbegi"        },
  { slug: "mtskheta",            destination: "gudauri"        },
  { slug: "zhinvali",            destination: "gudauri"        },
  { slug: "ananuri",             destination: "gudauri"        },
  { slug: "zugdidi",             destination: "mestia"         },
  { slug: "engurdam",            destination: "mestia"         },
  { slug: "khaishi",             destination: "mestia"         },
  { slug: "ureki",               destination: "batumi"         },
  { slug: "kobuleti",            destination: "batumi"         },
  { slug: "mtsvanekontskhi",     destination: "batumi"         },
  { slug: "surami",              destination: "kutaisi"        },
  { slug: "rikoti",              destination: "kutaisi"        },
  { slug: "gombori",             destination: "telavi"         },
  { slug: "tsinandali",          destination: "telavi"         },
  { slug: "gurjaani",            destination: "sighnaghi"      },
  { slug: "dedoplistskaro",      destination: "sighnaghi"      },
  { slug: "gori",                destination: "borjomi"        },
  { slug: "surami",              destination: "borjomi"        },
  { slug: "borjomi",             destination: "vardzia"        },
  { slug: "akhaltsikhe",         destination: "vardzia"        },
  { slug: "khertvisi",           destination: "vardzia"        },
  { slug: "ozurgeti",            destination: "bakhmaro"       },
  { slug: "chokhatauri",         destination: "bakhmaro"       },
  { slug: "ureki",               destination: "shekvetili"     },
  { slug: "kutaisi",             destination: "ureki"          },
  { slug: "kutaisi",             destination: "ambrolauri"     },
  { slug: "tkibuli",             destination: "ambrolauri"     },
  { slug: "kutaisi",             destination: "oni"            },
  { slug: "tkibuli",             destination: "oni"            },
  { slug: "surami",              destination: "martvili"       },
  { slug: "kutaisi",             destination: "martvili"       },
  { slug: "martvili",            destination: "zugdidi"        },
  { slug: "gori",                destination: "bakuriani"      },
  { slug: "surami",              destination: "bakuriani"      },
  { slug: "borjomi",             destination: "bakuriani"      },
  { slug: "gori",                destination: "akhaltsikhe"    },
  { slug: "borjomi",             destination: "akhaltsikhe"    },
  { slug: "borjomi",             destination: "abastumani"     },
  { slug: "akhaltsikhe",         destination: "abastumani"     },
  { slug: "gombori",             destination: "kvareli"        },
  { slug: "telavi",              destination: "kvareli"        },
  { slug: "gombori",             destination: "tsinandali"     },
  { slug: "telavi",              destination: "tsinandali"     },
  { slug: "surami",              destination: "okatse"         },
  { slug: "kutaisi",             destination: "okatse"         },
  { slug: "telavi",              destination: "tusheti"        },
  { slug: "pshaveli",            destination: "tusheti"        },
  { slug: "bazaleti",            destination: "khevsureti"     },
  { slug: "zhinvali",            destination: "khevsureti"     },
  { slug: "keda",                destination: "goderdzi"       },
  { slug: "makhuntseti",         destination: "goderdzi"       },
  { slug: "shuakhevi",           destination: "goderdzi"       },
  { slug: "ureki",               destination: "kobuleti"       },
  { slug: "kobuleti",            destination: "chakvi"         },
  { slug: "kobuleti",            destination: "tsikhisdziri"   },
  { slug: "kobuleti",            destination: "makhinjauri"    },
  { slug: "batumi",              destination: "kvariati"       },
  { slug: "mtsvanekontskhi",     destination: "kvariati"       },
  { slug: "batumi",              destination: "sarpi"          },
  { slug: "mtsvanekontskhi",     destination: "sarpi"          },
  { slug: "ureki",               destination: "grigoleti"      },
  { slug: "keda",                destination: "khulo"          },
  { slug: "makhuntseti",         destination: "khulo"          },
  { slug: "shuakhevi",           destination: "khulo"          },
  { slug: "mtskheta",            destination: "gori"           },
  { slug: "surami",              destination: "tskaltubo"      },
  { slug: "rikoti",              destination: "tskaltubo"      },
  { slug: "gombori",             destination: "lagodekhi"      },
  { slug: "telavi",              destination: "lagodekhi"      },
];

/**
 * What the local kitchen is known for.
 *
 * CR-2026-0036 asked for wine and gastronomy to stay as a theme and be filled
 * in "for every corner — Samegrelo, Kakheti, Guria and so on, wine for Kakheti
 * and Imereti". Cooking follows the provinces rather than the destinations,
 * which is why Region carries it: Zugdidi and Martvili eat the same food, and
 * writing it twice would be two places to correct it.
 *
 * `wine: true` marks the provinces where the wine is the reason to come, and
 * the page then also shows wine.<region>.
 */
export interface Cuisine {
  dishes: string[];
  wine?: boolean;
}

export const CUISINE: Record<Region, Cuisine> = {
  tbilisi:       { dishes: ["khinkali", "khashi", "lobiani"] },
  kartli:        { dishes: ["mtsvadi", "chakhokhbili", "nazuki"] },
  khevi:         { dishes: ["khinkali", "gudascheese"] },
  khevsureti:    { dishes: ["dambalkhacho", "khinkali"] },
  tusheti:       { dishes: ["gudascheese", "kotori"] },
  kakheti:       { dishes: ["mtsvadi", "chakapuli", "badrijani", "churchkhela"], wine: true },
  imereti:       { dishes: ["imerulikhachapuri", "pkhali", "satsivi"], wine: true },
  racha:         { dishes: ["rachulilori", "shkmeruli", "lobio"], wine: true },
  samegrelo:     { dishes: ["elarji", "gebzhalia", "megrulikhachapuri", "ajika"], wine: true },
  svaneti:       { dishes: ["kubdari", "chvishtari", "tashmijabi", "svanuriamarili"] },
  guria:         { dishes: ["gurulikhachapuri", "mchadi"], wine: true },
  adjara:        { dishes: ["acharulikhachapuri", "borano", "sinori", "malakhto"], wine: true },
  samtskhe:      { dishes: ["tatarberaki", "apokhti"] },
};

/** The sights that belong to a destination, in the order they are listed. */
export const sightsFor = (destination: string): Sight[] =>
  SIGHTS.filter((s) => s.destination === destination);

/** The stops on the way to a destination, in road order. */
export const stopsFor = (destination: string): Sight[] =>
  STOPS.filter((s) => s.destination === destination);

/**
 * Which vehicle classes a road is honest about.
 *
 * These are the vehicle_class enum members, so the answer lines up with what a
 * driver actually registers and what the search filters offer. Economy is left
 * off a mountain road not because it cannot climb but because four hours of it
 * is not what somebody thinks they are buying.
 */
export const CLASSES_FOR_ROAD: Record<RoadFit, string[]> = {
  paved:    ["ECONOMY", "COMFORT", "MINIVAN", "MINIBUS", "SUV_4X4", "PREMIUM"],
  mountain: ["COMFORT", "MINIVAN", "MINIBUS", "SUV_4X4", "PREMIUM"],
  offroad:  ["SUV_4X4"],
};

export const DESTINATIONS: Destination[] = [
  { slug: "tbilisi",      categories: ["culture"],                                   seasons: ["spring", "summer", "autumn", "winter"],            descKey: "map.d.tbilisi",       icon: "culture",   region: "tbilisi",     days: [2, 4], road: "paved", labelPos: "right" },
  { slug: "mtskheta",     categories: ["culture"],                                   seasons: ["spring", "summer", "autumn"],                      descKey: "map.d.mtskheta",      icon: "culture",   region: "kartli",      days: [1, 1], road: "paved", labelPos: "left" },
  { slug: "kazbegi",      categories: ["mountains", "nature"],                       seasons: ["spring", "summer", "autumn"],                      descKey: "map.d.kazbegi",       icon: "mountains", region: "khevi",       days: [1, 2], road: "mountain" },
  { slug: "gudauri",      categories: ["mountains", "winter"],                       seasons: ["winter"],                                          descKey: "map.d.gudauri",       icon: "winter",    region: "khevi",       days: [2, 4], road: "mountain", labelPos: "bottom" },
  { slug: "mestia",       categories: ["mountains", "nature", "winter"],             seasons: ["summer", "winter"],                                descKey: "map.d.mestia",        icon: "mountains", region: "svaneti",     days: [3, 5], road: "mountain" },
  { slug: "batumi",       categories: ["sea", "culture"],                            seasons: ["summer"],                                          descKey: "map.d.batumi",        icon: "sea",       region: "adjara",      days: [2, 4], road: "paved", labelPos: "left" },
  { slug: "kutaisi",      categories: ["culture", "nature"],                         seasons: ["spring", "summer", "autumn"],                      descKey: "map.d.kutaisi",       icon: "culture",   region: "imereti",     days: [1, 2], road: "paved" },
  { slug: "telavi",       categories: ["wine", "culture"],                           seasons: ["autumn", "spring", "summer"],                      descKey: "map.d.telavi",        icon: "wine",      region: "kakheti",     days: [1, 2], road: "paved", labelPos: "left" },
  { slug: "sighnaghi",    categories: ["wine", "culture"],                           seasons: ["autumn", "spring", "summer"],                      descKey: "map.d.sighnaghi",     icon: "wine",      region: "kakheti",     days: [1, 2], road: "paved", labelPos: "bottom" },
  { slug: "borjomi",      categories: ["nature", "culture"],                         seasons: ["spring", "summer", "autumn"],                      descKey: "map.d.borjomi",       icon: "nature",    region: "samtskhe",    days: [1, 2], road: "paved", labelPos: "left" },
  { slug: "vardzia",      categories: ["culture"],                                   seasons: ["spring", "summer", "autumn"],                      descKey: "map.d.vardzia",       icon: "culture",   region: "samtskhe",    days: [1, 2], road: "mountain", labelPos: "bottom" },
  { slug: "bakhmaro",     categories: ["mountains", "nature"],                       seasons: ["summer", "winter"],                                descKey: "map.d.bakhmaro",      icon: "mountains", region: "guria",       days: [2, 3], road: "offroad" },
  { slug: "shekvetili",   categories: ["sea", "nature"],                             seasons: ["summer"],                                          descKey: "map.d.shekvetili",    icon: "sea",       region: "guria",       days: [2, 4], road: "paved", labelPos: "left" },
  { slug: "ureki",        categories: ["sea"],                                       seasons: ["summer"],                                          descKey: "map.d.ureki",         icon: "sea",       region: "guria",       days: [2, 4], road: "paved", labelPos: "left", dy: -8 },
  { slug: "ambrolauri",   categories: ["wine", "nature", "culture"],                 seasons: ["spring", "summer", "autumn"],                      descKey: "map.d.ambrolauri",    icon: "wine",      region: "racha",       days: [2, 3], road: "mountain" },
  { slug: "oni",          categories: ["nature", "culture"],                         seasons: ["summer", "autumn"],                                descKey: "map.d.oni",           icon: "nature",    region: "racha",       days: [2, 3], road: "mountain" },
  { slug: "martvili",     categories: ["nature"],                                    seasons: ["spring", "summer", "autumn"],                      descKey: "map.d.martvili",      icon: "nature",    region: "samegrelo",   days: [1, 1], road: "paved" },
  { slug: "zugdidi",      categories: ["culture"],                                   seasons: ["spring", "summer", "autumn"],                      descKey: "map.d.zugdidi",       icon: "culture",   region: "samegrelo",   days: [1, 2], road: "paved" },
  { slug: "bakuriani",    categories: ["winter", "mountains", "nature"],             seasons: ["winter", "summer"],                                descKey: "map.d.bakuriani",     icon: "winter",    region: "samtskhe",    days: [2, 4], road: "mountain", labelPos: "right", dx: 6, dy: 6 },
  { slug: "akhaltsikhe",  categories: ["culture"],                                   seasons: ["spring", "summer", "autumn"],                      descKey: "map.d.akhaltsikhe",   icon: "culture",   region: "samtskhe",    days: [1, 1], road: "paved", labelPos: "bottom", dx: 8, dy: 8 },
  { slug: "abastumani",   categories: ["nature"],                                    seasons: ["summer", "autumn"],                                descKey: "map.d.abastumani",    icon: "nature",    region: "samtskhe",    days: [2, 3], road: "mountain", labelPos: "bottom", dx: -4, dy: -14 },
  { slug: "kvareli",      categories: ["wine"],                                      seasons: ["autumn", "spring", "summer"],                      descKey: "map.d.kvareli",       icon: "wine",      region: "kakheti",     days: [1, 2], road: "paved", labelPos: "right" },
  { slug: "tsinandali",   categories: ["wine", "culture"],                           seasons: ["autumn", "spring", "summer"],                      descKey: "map.d.tsinandali",    icon: "wine",      region: "kakheti",     days: [1, 1], road: "paved", labelPos: "top", dy: -6 },
  { slug: "okatse",       categories: ["nature"],                                    seasons: ["spring", "summer", "autumn"],                      descKey: "map.d.okatse",        icon: "nature",    region: "imereti",     days: [1, 1], road: "mountain", labelPos: "top", dy: -6 },
  { slug: "tusheti",      categories: ["mountains", "nature"],                       seasons: ["summer"],                                          descKey: "map.d.tusheti",       icon: "mountains", region: "tusheti",     days: [3, 4], road: "offroad", labelPos: "right" },
  { slug: "khevsureti",   categories: ["mountains", "nature"],                       seasons: ["summer"],                                          descKey: "map.d.khevsureti",    icon: "mountains", region: "khevsureti",  days: [2, 3], road: "offroad", labelPos: "top", dy: -8 },
  { slug: "goderdzi",     categories: ["winter", "mountains"],                       seasons: ["winter", "summer"],                                descKey: "map.d.goderdzi",      icon: "winter",    region: "adjara",      days: [2, 3], road: "offroad", labelPos: "bottom" },
  { slug: "kobuleti",     categories: ["sea", "nature"],                             seasons: ["summer"],                                          descKey: "map.d.kobuleti",      icon: "sea",       region: "adjara",      days: [3, 5], road: "paved" },
  { slug: "chakvi",       categories: ["sea", "nature"],                             seasons: ["summer"],                                          descKey: "map.d.chakvi",        icon: "sea",       region: "adjara",      days: [2, 4], road: "paved", labelPos: "left" },
  { slug: "tsikhisdziri", categories: ["sea", "culture"],                            seasons: ["summer"],                                          descKey: "map.d.tsikhisdziri",  icon: "sea",       region: "adjara",      days: [2, 4], road: "paved", labelPos: "left" },
  { slug: "makhinjauri",  categories: ["sea"],                                       seasons: ["summer"],                                          descKey: "map.d.makhinjauri",   icon: "sea",       region: "adjara",      days: [2, 4], road: "paved", labelPos: "left" },
  { slug: "kvariati",     categories: ["sea"],                                       seasons: ["summer"],                                          descKey: "map.d.kvariati",      icon: "sea",       region: "adjara",      days: [2, 4], road: "paved", labelPos: "left" },
  { slug: "sarpi",        categories: ["sea"],                                       seasons: ["summer"],                                          descKey: "map.d.sarpi",         icon: "sea",       region: "adjara",      days: [1, 2], road: "paved", labelPos: "bottom" },
  { slug: "grigoleti",    categories: ["sea", "nature"],                             seasons: ["summer"],                                          descKey: "map.d.grigoleti",     icon: "sea",       region: "guria",       days: [2, 4], road: "paved", labelPos: "left" },
  { slug: "khulo",        categories: ["mountains", "nature"],                       seasons: ["summer", "autumn"],                                descKey: "map.d.khulo",         icon: "mountains", region: "adjara",      days: [1, 2], road: "mountain", labelPos: "bottom" },
  { slug: "gori",         categories: ["culture"],                                   seasons: ["spring", "summer", "autumn"],                      descKey: "map.d.gori",          icon: "culture",   region: "kartli",      days: [1, 1], road: "paved", labelPos: "top" },
  { slug: "tskaltubo",    categories: ["culture", "nature"],                         seasons: ["spring", "summer", "autumn"],                      descKey: "map.d.tskaltubo",     icon: "culture",   region: "imereti",     days: [1, 2], road: "paved", labelPos: "left" },
  { slug: "lagodekhi",    categories: ["nature"],                                    seasons: ["spring", "summer", "autumn"],                      descKey: "map.d.lagodekhi",     icon: "nature",    region: "kakheti",     days: [1, 2], road: "paved", labelPos: "right" },
];

/**
 * Three clarifications added to the open round.
 *
 * Added to tiebreak-2026-09 rather than sent as a third link: nobody had
 * answered it yet, and a third URL is a third thing to lose. One link is
 * worth more than tidy separation.
 *
 * All three come from things that are already ambiguous in writing:
 *   - CR-2026-0026 says "delete this" and attaches a screenshot nobody
 *     answering the form can see.
 *   - Hourly hire now has three positions on record, one of them live.
 *   - Sandro described a booking box that behaves differently from the one
 *     that is deployed, so it is unclear whether he is reporting a fault or
 *     describing a preference.
 *
 *   npx tsx db/seed-decisions-2b.ts
 */
import "dotenv/config";
import { sql } from "./client";

const SLUG = "tiebreak-2026-09";

const TITLE = "რაც ჯერ არ გადაწყდა";
const LEDE =
  "შვიდი საკითხი. პირველი ოთხი — სადაც ერთმანეთს არ დაეთანხმეთ; თითოეულზე წერია, " +
  "ვინ რა აირჩია და რა დაწერა, რომ ამჯერად ერთმანეთის პასუხის ცოდნით გადაწყვიტოთ. " +
  "ბოლო სამი — სადაც დაწერილიდან ვერ გავიგეთ, რას გულისხმობდით. " +
  "უპასუხეთ მხოლოდ იმას, რაც თქვენ გეხებათ.";

const MORE = [
  {
    ticket: "CR-2026-0026", item: "დაზუსტება",
    title: "„ეს წავშალოთ“ — რომელი ნაწილი?",
    ask: "ეს წავშალოთ, ზედმეტია დეტალური ინფორმაციაა სად მიდის",
    stands: [
      "მოთხოვნას სკრინშოტი ახლავს, მაგრამ ტექსტში არ წერია, რომელ გვერდზეა საქმე — და სკრინშოტი ჩვენს გარდა ვერავინ ნახავს ამ ფორმაში.",
      "ვარაუდით წაშლას არ ვიწყებთ: „დეტალური ინფორმაცია სად მიდის“ ოთხ სხვადასხვა ადგილს შეიძლება ნიშნავდეს, და არასწორის წაშლა ცოცხალ გვერდს აზიანებს.",
    ],
    refs: ["CR-2026-0026"],
    need: "რომელ ბლოკზეა საუბარი? თუ სიაში არ არის — დაწერეთ შენიშვნებში, რომელ გვერდზე იყავით.",
    options: [
      { v: "tourtimeline", label: "ტურის გვერდზე მარშრუტის ქრონოლოგია (დღე-დღეზე გაჩერებები)", why: "ტურის გვერდის შუა ნაწილი, სადაც თითოეული გაჩერებაა ჩამოთვლილი." },
      { v: "transferroute", label: "ტრანსფერის გვერდზე მარშრუტის აღწერა", why: "ტექსტი, რომელიც გზას და გაჩერებების დამატებას აღწერს." },
      { v: "destdistance", label: "მიმართულების გვერდზე მანძილისა და დროის ბლოკი", why: "„თბილისიდან — რამდენი საათი, რამდენი კილომეტრი“." },
      { v: "planlist", label: "მარშრუტის ამწყობში დღეების სია", why: "/ka/plan — გენერირებული გეგმის დღე-დღეზე ჩამონათვალი." },
    ],
  },
  {
    ticket: "CR-2026-0011", item: "პუნქტი 23 · სამი პასუხი",
    title: "საათობრივი გაქირავება: სამი სხვადასხვა პასუხი გვაქვს",
    ask: "საათობრივი გაქირავება რეალურ სერვისად: 4 / 6 / 8 / 10 საათი, ფასთან ერთად.",
    stands: [
      "ნიკუშამ პირველ რაუნდზე აირჩია: „მოვხსნათ საათობრივი გაქირავება, სანამ მზად არ იქნება“.",
      "სანდრომ იმავე კითხვაზე ვარიანტი არ აირჩია, მაგრამ დაწერა: „ფასი განისაზღვრება დღის მიხედვით — 12 საათი მომსახურების ფასი + კილომეტრების და საწვავის ფასის მიხედვით გამოითვლება საბოლოო თანხა. გადაჭარბება არ უნდა მოხდეს.“",
      "საიტზე ამ წუთში კი წერია: „მანქანა მძღოლით ოთხი, ექვსი, რვა ან ათი საათით“. ანუ სამი განსხვავებული პასუხია, და ერთი მათგანი უკვე ცოცხალია.",
    ],
    refs: ["src/app/[locale]/hourly/page.tsx", "business.p6b"],
    need: "ერთი უნდა დარჩეს. თუ ფასს ირჩევთ, დაწერეთ რიცხვები — მათ გარეშე გვერდი დასაჯავშნი ვერ გახდება.",
    options: [
      { v: "remove", label: "ნიკუშას პასუხი: მოვხსნათ საიტიდან, სანამ ფასები არ გვაქვს", why: "ხსნის დაპირებას, რომელსაც ონლაინ ვერ ვასრულებთ. ერთი დღის სამუშაო." },
      { v: "dayrate", label: "სანდროს პასუხი: 12-საათიანი დღის ტარიფი + კილომეტრი და საწვავი", why: "ეს სხვა სერვისია, ვიდრე 4/6/8/10 საათი — გვერდი და ტექსტი თავიდან იწერება. რიცხვები შენიშვნებში მოგვწერეთ." },
      { v: "packages", label: "დავტოვოთ 4 / 6 / 8 / 10 საათი და ფასები დავამატოთ", why: "როგორც მოთხოვნაშია. საჭიროა ოთხივე ფასი, კლასის და ქალაქის მიხედვით." },
      { v: "enquiry", label: "დარჩეს მოთხოვნის ფორმად, ფასის გარეშე", why: "დღევანდელი მდგომარეობა. პატიოსანია, მაგრამ ჯავშანს არ იძლევა." },
    ],
  },
  {
    ticket: "CR-2026-0015", item: "პუნქტი 48 · დაზუსტება",
    title: "დაჯავშნის ველები მთავარ გვერდზე — ხარვეზია თუ სურვილი?",
    ask: "სანდრომ დაწერა: „თარიღის და მიმართულების პუნქტები ავწიოთ ზევით, რადგან როცა საიტზე შევლენ, პირდაპირ ჩამოუშლელად შეძლონ მისამართის და დროის მონიშვნა, შემდეგ მძღოლის არჩევაზე გადასვლა.“",
    stands: [
      "დაჯავშნის ბლოკი დღეს მთავარი გვერდის მეორე ბლოკია, ჰერო-სურათის ზუსტად ქვემოთ — უფრო მაღლა მხოლოდ სათაურია.",
      "ფართო ეკრანზე ველები ერთ ზოლადაა და პირდაპირ ჩანს; ვიწრო ეკრანზე ისინი ერთმანეთის ქვემოთ ეწყობა.",
      "ამიტომ ვერ ვხვდებით, ეს ხარვეზის შესახებ იყო თუ სურვილის: თუ ტელეფონზე რაღაც დასაჭერია, სანამ თარიღს აირჩევ — ეს შესაკეთებელია და არა გადასაწყობი.",
    ],
    refs: ["src/components/search-form.tsx", "src/app/[locale]/page.tsx:228"],
    need: "რომელია? თუ ხარვეზია, დაწერეთ ტელეფონზე თუ კომპიუტერზე შეგხვდათ.",
    options: [
      { v: "bug", label: "ხარვეზია — ველი მაშინვე არ იხსნება, დაჭერა სჭირდება", why: "თუ ასეა, ეს გასასწორებელია და არა გვერდის გადასაწყობი." },
      { v: "higher", label: "სურვილია — ველები კიდევ უფრო მაღლა, სურათზე ან მის ნაცვლად", why: "ჰერო-სურათი პატარავდება ან ქრება; დაჯავშნა ხდება პირველი, რასაც ხედავ." },
      { v: "fine", label: "ასეც კარგადაა — არაფერი შესაცვლელი", why: "დაჯავშნის ბლოკი ისედაც მეორეა და ველები ჩანს." },
    ],
  },
];

async function main() {
  const [round] = await sql<{ id: string }[]>`
    SELECT id FROM decision_rounds WHERE slug = ${SLUG}`;
  if (!round) throw new Error(`round ${SLUG} not found — seed it first`);

  const [count] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM decision_questions WHERE round_id = ${round.id}::uuid`;
  if ((count?.n ?? 0) > 4) {
    console.log(`Round already has ${count?.n} questions — clarifications look added. Nothing to do.`);
    return;
  }

  await sql`
    UPDATE decision_rounds SET title = ${TITLE}, lede = ${LEDE} WHERE id = ${round.id}::uuid`;

  let position = 50;
  for (const q of MORE) {
    await sql`
      INSERT INTO decision_questions
        (round_id, position, ticket, item, title, ask, stands, refs, need, options)
      VALUES (
        ${round.id}::uuid, ${position}, ${q.ticket}, ${q.item}, ${q.title}, ${q.ask},
        ${q.stands}, ${q.refs}, ${q.need}, ${JSON.stringify(q.options)}::text::jsonb
      )`;
    position += 10;
  }
  console.log(`Added ${MORE.length} clarifications to "${SLUG}" and retitled it.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });

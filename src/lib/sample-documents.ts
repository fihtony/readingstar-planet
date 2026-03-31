import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";

interface SampleDocumentSeed {
  id: string;
  title: string;
  originalFilename: string;
  content: string;
}

const STORY_SAMPLE_DOCUMENTS: SampleDocumentSeed[] = [
  {
    id: "sample-brave-little-otter",
    title: "The Brave Little Otter",
    originalFilename: "the-brave-little-otter.txt",
    content: `Ollie was the smallest otter in Willow River, but he had the biggest questions.

Each morning, Ollie watched the older otters dive, spin, and splash through the bright water. He wanted to join them, yet his paws felt shaky when he stood on the smooth river rock.

One sunny day, Grandma Otter smiled and said, "Brave does not mean you never feel wobbly. Brave means you try the next small step."

Ollie took one small step into the water. Then he took another. Soon he was floating like a brown leaf on a gentle wave.

By sunset, Ollie could paddle beside the others. He grinned and whispered, "My brave step was small, but it took me somewhere new."`,
  },
  {
    id: "sample-moonlight-picnic",
    title: "Moonlight Picnic",
    originalFilename: "moonlight-picnic.txt",
    content: `Mina packed blueberries, warm bread, and a bright blue blanket for a moonlight picnic.

When the sky turned silver, she climbed the hill behind her house with her brother Ben and their dog, Pepper. Fireflies blinked beside the path like tiny lanterns.

At the top of the hill, the moon looked like a round pearl. Ben pointed to the clouds and said they looked like sleepy sheep drifting across the sky.

Pepper curled up on the blanket while Mina read a funny poem out loud. The wind was cool, the bread was soft, and the night felt calm and wide.

Before they walked home, Mina made a wish. She wished for more evenings that felt gentle, bright, and full of wonder.`,
  },
  {
    id: "sample-benny-and-the-blue-kite",
    title: "Benny and the Blue Kite",
    originalFilename: "benny-and-the-blue-kite.txt",
    content: `Benny built a blue kite with paper, string, and two bendy sticks.

He painted a bold silver moon on the middle and tied six tiny ribbons to the tail. "This kite will dance," Benny said.

At the park, the wind pushed and puffed, but the kite bumped along the grass instead of rising. Benny frowned for a moment.

Then his friend Quinn shouted, "Run with the wind, not against it!" Benny turned, took a deep breath, and dashed across the field.

The blue kite leaped up at last. It dipped, swayed, and sailed high above the trees while Benny laughed so hard that he had to stop and catch his breath.`,
  },
  {
    id: "sample-rainy-day-robot",
    title: "A Rainy Day Robot",
    originalFilename: "a-rainy-day-robot.txt",
    content: `Pia was bored on a rainy Saturday, so she opened her craft box and decided to invent something surprising.

She used a silver oatmeal tin for the body, bottle caps for buttons, and a bendy straw for one silly arm. When she added a paper hat, the robot looked ready for a parade.

Pia named the robot Pip. She pretended Pip could beep in three cheerful notes and sweep puddles away with a tiny broom.

Soon her room became a workshop, then a rocket lab, and then a bakery where Pip served pretend plum pies.

By the time the rain stopped, Pia was not bored at all. She had learned that a cloudy day could still sparkle when her imagination got to work.`,
  },
  {
    id: "sample-quiet-forest-map",
    title: "The Quiet Forest Map",
    originalFilename: "the-quiet-forest-map.txt",
    content: `Tara found the map in the back pocket of an old green backpack.

The paper was folded into neat squares, and each corner held a tiny drawing: a pine tree, a pond, a patch of blackberries, and a sleeping fox.

With her cousin Jude, Tara followed the path behind the garden gate. They crossed a wooden bridge, listened to the buzz of bees, and counted bright mushrooms near a stump.

At the very end of the trail, they discovered a bench under a giant oak tree. Carved into the wood were the words, "Quiet places help brave thoughts grow."

Tara tucked the map into her pocket again. She knew she would return, because the forest had shared a secret that felt peaceful and strong.`,
  },
];

const ENGLISH_SAMPLE_SPECS = [
  {
    id: "sample-converting-energy-to-motion",
    title: "Converting Energy to Motion",
    originalFilename: "Converting Energy to Motion.txt",
  },
  {
    id: "sample-evaluating-in-math",
    title: "Evaluating in Math",
    originalFilename: "Evaluating in Math.txt",
  },
  {
    id: "sample-forms-of-matter",
    title: "Forms of Matter",
    originalFilename: "Forms of Matter.txt",
  },
] as const;

function loadEnglishSampleDocuments(): SampleDocumentSeed[] {
  const englishDir = path.join(process.cwd(), "..", "english");

  return ENGLISH_SAMPLE_SPECS.flatMap((spec) => {
    const filePath = path.join(englishDir, spec.originalFilename);
    if (!fs.existsSync(filePath)) {
      return [];
    }

    return [
      {
        ...spec,
        content: fs.readFileSync(filePath, "utf-8").replace(/\r\n?/g, "\n"),
      },
    ];
  });
}

export const SAMPLE_DOCUMENTS: SampleDocumentSeed[] = [
  ...STORY_SAMPLE_DOCUMENTS,
  ...loadEnglishSampleDocuments(),
];

const SAMPLE_METADATA_KEY = "sample_documents_seeded_v3";

export function seedSampleDocuments(db: Database.Database): number {
  if (process.env.READINGSTAR_DISABLE_SAMPLE_SEED === "1") {
    return 0;
  }

  const alreadySeeded = db
    .prepare("SELECT value FROM app_metadata WHERE key = ?")
    .get(SAMPLE_METADATA_KEY) as { value: string } | undefined;

  if (alreadySeeded?.value === "true") {
    return 0;
  }

  const now = new Date().toISOString();

  // Ensure the system/default user exists (required for FK constraint on uploaded_by).
  // This is a legacy system account; it cannot log in with Google OAuth.
  db.prepare(
    `INSERT OR IGNORE INTO users (id, email, name, nickname, role, status, created_at, updated_at)
     VALUES ('default-user', 'default@readingstar.local', 'System', 'System', 'admin', 'active', ?, ?)`
  ).run(now, now);

  const insertDocument = db.prepare(
    `INSERT OR IGNORE INTO documents (
      id,
      title,
      content,
      original_filename,
      file_type,
      file_size,
      uploaded_by,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, 'txt', ?, 'default-user', ?, ?)`
  );
  const markSeeded = db.prepare(
    `INSERT INTO app_metadata (key, value, updated_at)
     VALUES (?, 'true', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  );

  const seedTransaction = db.transaction(() => {
    for (const sample of SAMPLE_DOCUMENTS) {
      insertDocument.run(
        sample.id,
        sample.title,
        sample.content,
        sample.originalFilename,
        sample.content.length,
        now,
        now
      );
    }

    markSeeded.run(SAMPLE_METADATA_KEY, now);
  });

  seedTransaction();
  return SAMPLE_DOCUMENTS.length;
}
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "mentlio.json");

export interface DatabaseSchema {
  users: Array<Record<string, any>>;
  mentors: Array<Record<string, any>>;
  userQuizData: Array<Record<string, any>>;
  others: Array<Record<string, any>>;
  notification: Array<Record<string, any>>;
  colleges: Array<Record<string, any>>;
  tracks: Array<Record<string, any>>;
  mentor_sessions: Array<Record<string, any>>;
  payments: Array<Record<string, any>>;
  orders: Array<Record<string, any>>;
  // Written by the browser client through /api/data/[table].
  messages: Array<Record<string, any>>;
  job_tracker: Array<Record<string, any>>;
  userCalendar: Array<Record<string, any>>;
  roadmapUsers: Array<Record<string, any>>;
  proctor_events: Array<Record<string, any>>;
}

const DEFAULT_DB: DatabaseSchema = {
  users: [],
  mentors: [
    {
      id: "mentor-1",
      full_name: "Aman Gupta",
      email: "aman@mentlio.local",
      phone: "+91 9876543210",
      linkedin: "https://linkedin.com/in/amangupta",
      bio: "Senior Software Architect at Google with 10+ years of cloud distributed systems experience.",
      expertise: ["Full Stack", "System Design", "Cloud Architecture"],
      current_position: "Staff Software Engineer",
      availability: true,
      rating: 4.9,
      avatar: "/a1.png",
      created_at: new Date().toISOString(),
      is_verified: true,
      video_url: null,
    },
    {
      id: "mentor-2",
      full_name: "Sneha Reddy",
      email: "sneha@mentlio.local",
      phone: "+91 9876543211",
      linkedin: "https://linkedin.com/in/snehareddy",
      bio: "Tech Lead & AI specialist. Passionate about helping students transition into ML & data engineering.",
      expertise: ["Machine Learning", "Python", "Data Engineering"],
      current_position: "Lead AI Engineer",
      availability: true,
      rating: 4.8,
      avatar: "/a2.png",
      created_at: new Date().toISOString(),
      is_verified: true,
      video_url: null,
    },
  ],
  userQuizData: [],
  others: [],
  notification: [],
  colleges: [
    { id: 1, name: "Indian Institute of Technology, Bombay", location: "Mumbai", rating: 4.9 },
    { id: 2, name: "Indian Institute of Technology, Delhi", location: "New Delhi", rating: 4.9 },
    { id: 3, name: "BITS Pilani", location: "Pilani", rating: 4.8 },
  ],
  tracks: [],
  mentor_sessions: [],
  payments: [],
  orders: [],
  messages: [],
  job_tracker: [],
  userCalendar: [],
  roadmapUsers: [],
  proctor_events: [],
};

function getStoragePath(): string {
  // If running in Vercel/AWS Lambda serverless environment, process.cwd() is read-only.
  // We use /tmp/mentlio.json for writable persistence across warm lambdas, seeded from bundled DB.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpFile = path.join("/tmp", "mentlio.json");
    if (!fs.existsSync(tmpFile)) {
      try {
        if (fs.existsSync(DB_FILE)) {
          fs.copyFileSync(DB_FILE, tmpFile);
        } else {
          fs.writeFileSync(tmpFile, JSON.stringify(DEFAULT_DB, null, 2), "utf8");
        }
      } catch (err) {
        console.error("Error initializing /tmp/mentlio.json:", err);
      }
    }
    return tmpFile;
  }
  return DB_FILE;
}

function ensureDbFile(): DatabaseSchema {
  try {
    const targetFile = getStoragePath();
    if (!fs.existsSync(targetFile)) {
      if (!fs.existsSync(path.dirname(targetFile))) {
        fs.mkdirSync(path.dirname(targetFile), { recursive: true });
      }
      fs.writeFileSync(targetFile, JSON.stringify(DEFAULT_DB, null, 2), "utf8");
      return DEFAULT_DB;
    }
    let raw = fs.readFileSync(targetFile, "utf8");
    if (raw.charCodeAt(0) === 0xFEFF) {
      raw = raw.slice(1);
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading database file, using fallback:", err);
    return DEFAULT_DB;
  }
}

export function readDb(): DatabaseSchema {
  const db = ensureDbFile();
  // Migration: files written before a table was added must still expose it.
  for (const key of Object.keys(DEFAULT_DB) as Array<keyof DatabaseSchema>) {
    if (!Array.isArray(db[key])) db[key] = [];
  }
  return db;
}

export function isKnownTable(tableName: string): boolean {
  return Object.prototype.hasOwnProperty.call(readDb(), tableName);
}

export function writeDb(data: DatabaseSchema): void {
  try {
    const targetFile = getStoragePath();
    const targetDir = path.dirname(targetFile);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const tempFile = `${targetFile}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tempFile, targetFile);
  } catch (err) {
    console.error("Error writing database file:", err);
  }
}

export function getTable(tableName: keyof DatabaseSchema): Array<Record<string, any>> {
  const db = readDb();
  return db[tableName] || [];
}

export function mutateTable(
  tableName: keyof DatabaseSchema,
  fn: (rows: Array<Record<string, any>>) => Array<Record<string, any>>
): void {
  const db = readDb();
  if (!db[tableName]) {
    db[tableName] = [];
  }
  db[tableName] = fn(db[tableName]);
  writeDb(db);
}

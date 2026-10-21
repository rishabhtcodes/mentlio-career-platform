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
};

function ensureDbFile(): DatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), "utf8");
      return DEFAULT_DB;
    }
    const raw = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading database file, using fallback:", err);
    return DEFAULT_DB;
  }
}

export function readDb(): DatabaseSchema {
  return ensureDbFile();
}

export function writeDb(data: DatabaseSchema): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tempFile, DB_FILE);
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

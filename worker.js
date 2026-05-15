import cron from "node-cron";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`ENV ${name} belum diisi`);
  }
  return value.trim();
}

const EVOLUTION_URL = requiredEnv("EVOLUTION_URL").replace(/\/+$/, "");
const EVOLUTION_API_KEY = requiredEnv("EVOLUTION_API_KEY");
const EVOLUTION_INSTANCE = requiredEnv("EVOLUTION_INSTANCE");

const GROUP_JIDS = requiredEnv("GROUP_JIDS")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "*/2 * * * *";
const TIMEZONE = process.env.TZ || "Asia/Jakarta";
const RUN_ON_START = process.env.RUN_ON_START === "true";
const DRY_RUN = process.env.DRY_RUN === "true";

const ACTIVE_DURATION_HOURS = Number(process.env.ACTIVE_DURATION_HOURS || 3);
const START_TIME = Date.now();

const MESSAGES = (process.env.MESSAGES || "Tes pesan dari worker Railway")
  .split("|")
  .map((item) => item.trim())
  .filter(Boolean);

// penanda grup yang akan dikirim berikutnya
let currentGroupIndex = 0;

function isStillActive() {
  const activeUntil = START_TIME + ACTIVE_DURATION_HOURS * 60 * 60 * 1000;
  return Date.now() < activeUntil;
}

function pickMessage() {
  const index = Math.floor(Math.random() * MESSAGES.length);
  return MESSAGES[index];
}

function getNextGroup() {
  const groupJid = GROUP_JIDS[currentGroupIndex];
  currentGroupIndex = (currentGroupIndex + 1) % GROUP_JIDS.length;
  return groupJid;
}

async function sendText(groupJid, text) {
  const url = `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`;

  const payload = {
    number: groupJid,
    text
  };

  if (DRY_RUN) {
    console.log("[DRY RUN] Tidak mengirim pesan:", payload);
    return;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: EVOLUTION_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Gagal kirim ke ${groupJid}. Status ${response.status}. Response: ${responseText}`
    );
  }

  console.log(`Berhasil kirim ke ${groupJid}`);
  console.log(responseText);
}

async function runJob() {
  if (!isStillActive()) {
    console.log(
      `Worker sudah melewati batas aktif ${ACTIVE_DURATION_HOURS} jam. Tidak kirim pesan lagi.`
    );
    return;
  }

  console.log("======================================");
  console.log(`Mulai job: ${new Date().toISOString()}`);

  const groupJid = getNextGroup();
  const text = pickMessage();

  console.log(`Target grup kali ini: ${groupJid}`);

  try {
    await sendText(groupJid, text);
  } catch (error) {
    console.error(error.message);
  }

  console.log("Job selesai");
  console.log("======================================");
}

console.log("Worker aktif");
console.log(`Jadwal cron: ${CRON_SCHEDULE}`);
console.log(`Timezone: ${TIMEZONE}`);
console.log(`Durasi aktif: ${ACTIVE_DURATION_HOURS} jam`);
console.log(`Total grup target: ${GROUP_JIDS.length}`);

cron.schedule(
  CRON_SCHEDULE,
  async () => {
    await runJob();
  },
  {
    timezone: TIMEZONE
  }
);

if (RUN_ON_START) {
  runJob();
}

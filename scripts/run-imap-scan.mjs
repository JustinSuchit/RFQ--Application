const baseUrl = process.env.CRON_URL || "http://localhost:3000";
const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error("CRON_SECRET is required.");
  process.exit(1);
}

const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/cron/imap-scan`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${secret}`,
  },
});

const body = await response.text();
console.log(body);

if (!response.ok) {
  process.exit(1);
}

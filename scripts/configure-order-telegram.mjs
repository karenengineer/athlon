import { randomBytes } from "node:crypto";
import {
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { stderr, stdin } from "node:process";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

class SetupError extends Error {}

const telegramUsername = /^[A-Za-z0-9_]{1,32}$/;
const maxPollAttempts = 6;

async function requestTelegram(token, method, payload, signal, errorMessage) {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/${method}`,
      {
        method: "POST",
        redirect: "error",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
      },
    );
    if (!response.ok || !response.body) throw new Error();

    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.byteLength;
      if (size > 128 * 1024) throw new Error();
      chunks.push(chunk);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (body?.ok !== true) throw new Error();
    return body.result;
  } catch {
    throw new SetupError(errorMessage);
  }
}

function prepareDestination(destination) {
  const directory = dirname(destination);
  mkdirSync(directory, { mode: 0o700, recursive: true });
  const owner = lstatSync(directory);
  if (
    !owner.isDirectory() ||
    owner.uid !== process.getuid() ||
    (owner.mode & 0o077) !== 0
  ) {
    throw new SetupError(
      "The .private directory must be owned by you and accessible only to you.",
    );
  }
  if (existsSync(destination)) {
    throw new SetupError("The protected order Telegram file already exists.");
  }
  return directory;
}

function saveConfiguration(destination, directory, token, chatId) {
  const stagedDirectory = mkdtempSync(join(directory, ".order-telegram-"));
  try {
    const stagedFile = join(stagedDirectory, "order-telegram.env");
    const settings = `ORDER_TELEGRAM_BOT_TOKEN=${token}\nORDER_TELEGRAM_CHAT_ID=${chatId}\n`;
    writeFileSync(stagedFile, settings, { mode: 0o600, flag: "wx" });
    linkSync(stagedFile, destination);
  } finally {
    rmSync(stagedDirectory, { recursive: true, force: true });
  }
}

export async function configureOrderTelegram({
  token,
  username,
  destination,
  showChallenge,
  signal = new AbortController().signal,
}) {
  const recipient = username.replace(/^@/, "").toLowerCase();
  if (!telegramUsername.test(recipient))
    throw new SetupError("Enter a valid Telegram username.");
  if (token.length > 256 || !/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
    throw new SetupError("Enter the order bot token from BotFather.");
  }
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    throw new SetupError(
      "Enable TLS certificate verification before setting up Telegram.",
    );
  }
  const directory = prepareDestination(destination);
  const botError =
    "Could not verify the bot with Telegram. Check the token and connectivity.";
  const bot = await requestTelegram(token, "getMe", {}, signal, botError);
  if (
    bot?.is_bot !== true ||
    typeof bot.username !== "string" ||
    !telegramUsername.test(bot.username)
  ) {
    throw new SetupError(botError);
  }

  const challenge = `/start athlon_${randomBytes(16).toString("hex")}`;
  await showChallenge(bot.username, challenge);
  const updatesError =
    "Could not read the private setup message. Check the bot and retry.";
  for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
    const updates = await requestTelegram(
      token,
      "getUpdates",
      { timeout: 5, limit: 100 },
      signal,
      updatesError,
    );
    if (!Array.isArray(updates)) throw new SetupError(updatesError);
    const chatIds = new Set();
    for (const { message } of updates) {
      if (
        message?.text === challenge &&
        message.chat?.type === "private" &&
        Number.isSafeInteger(message.chat.id) &&
        message.chat.id > 0 &&
        message.from?.is_bot === false &&
        message.from.id === message.chat.id &&
        typeof message.from.username === "string" &&
        message.from.username.toLowerCase() === recipient
      ) {
        chatIds.add(message.chat.id);
      }
    }
    if (chatIds.size > 1) throw new SetupError(updatesError);
    if (chatIds.size === 1) {
      signal.throwIfAborted();
      saveConfiguration(destination, directory, token, [...chatIds][0]);
      return;
    }
    if (attempt + 1 < maxPollAttempts) await delay(500, undefined, { signal });
  }
  throw new SetupError(
    "No matching private message arrived. Send the exact command from the specified account and retry.",
  );
}

async function runSetup(username) {
  if (
    !stdin.isTTY ||
    !stderr.isTTY ||
    !username ||
    !telegramUsername.test(username.replace(/^@/, ""))
  ) {
    throw new SetupError(
      "Open a private terminal and run node scripts/configure-order-telegram.mjs @YourTelegramUsername.",
    );
  }
  const destination = fileURLToPath(
    new URL("../../.private/order-telegram.env", import.meta.url),
  );
  const controller = new AbortController();
  const hiddenOutput = new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
  });
  const terminal = createInterface({
    input: stdin,
    output: hiddenOutput,
    terminal: true,
  });
  terminal.on("SIGINT", () => controller.abort());
  const prompt = async (message) => {
    stderr.write(message);
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(300_000),
    ]);
    try {
      return await terminal.question("", { signal });
    } finally {
      stderr.write("\n");
    }
  };
  try {
    const token = (await prompt("Order bot token (hidden) ")).trim();
    await configureOrderTelegram({
      token,
      username,
      destination,
      signal: controller.signal,
      showChallenge: async (botUsername, command) => {
        stderr.write(
          `Open @${botUsername} in Telegram as @${username.replace(/^@/, "")}.\n`,
        );
        stderr.write(
          `Send this exact message in the private bot chat\n${command}\n`,
        );
        await prompt("Press Return after sending it. ");
      },
    });
    stderr.write("Settings saved to ../.private/order-telegram.env.\n");
  } finally {
    terminal.close();
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    await runSetup(process.argv[2]);
  } catch (error) {
    stderr.write(
      `${error instanceof SetupError ? error.message : "Order Telegram setup could not finish."}\n`,
    );
    process.exitCode = 1;
  }
}

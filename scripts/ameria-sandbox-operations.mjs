import { randomUUID } from "node:crypto";
import {
  link,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  realpath,
  unlink,
} from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const sandbox = "https://servicestest.ameriabank.am/VPOS/api/VPOS/";
const amount = 10;
const currency = "051";
const states = [
  "payment_started",
  "payment_approved",
  "payment_deposited",
  "payment_void",
  "payment_refunded",
  "payment_autoauthorized",
  "payment_declined",
];
const operations = { refund: "RefundPayment", cancel: "CancelPayment" };
const paymentIdPattern = /^[a-zA-Z0-9-]{1,100}$/;
const referencePattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const utcPattern = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/;

const help = `Ameriabank sandbox certification (Node.js 22)

node [--env-file=PATH] scripts/ameria-sandbox-operations.mjs COMMAND \\
  --evidence-dir /absolute/private/directory

Commands:
  inspect [--record]                         Read details and optionally record a verified deposit
  refund  [--apply]                          Preview or apply a full AMD 10 sandbox refund
  cancel  --initialized-at ISO_UTC [--apply] Preview or apply a fresh sandbox preauthorization cancellation
  verify                                     Check a recorded attempt without sending another mutation
  report                                     Print sanitized JSON evidence and verified totals

Except for report, provide --payment-id ID --order-id ID --reference UUID from
one CardPaymentSandboxSession row. Use the same evidence directory throughout.
Bank commands read AMERIA_SANDBOX_USERNAME and AMERIA_SANDBOX_PASSWORD.
`;

class CliError extends Error {}

function fail(message) {
  throw new CliError(message);
}

function validOrderId(value) {
  return (
    typeof value === "string" &&
    /^\d{8}$/.test(value) &&
    Number(value) >= 30_543_001 &&
    Number(value) <= 30_544_000
  );
}

function utcTime(value) {
  if (typeof value !== "string" || !utcPattern.test(value)) return NaN;
  const parsed = Date.parse(value);
  const canonical = value.length === 20 ? value.slice(0, -1) + ".000Z" : value;
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === canonical
    ? parsed
    : NaN;
}

function parseCommand(args) {
  const [command, ...options] = args;
  if (!["inspect", "refund", "cancel", "verify", "report"].includes(command))
    fail("Use --help to see the available commands.");
  const common = { "evidence-dir": { type: "string" } };
  if (command !== "report")
    Object.assign(common, {
      "payment-id": { type: "string" },
      "order-id": { type: "string" },
      reference: { type: "string" },
    });
  if (command === "inspect") common.record = { type: "boolean" };
  if (command === "refund" || command === "cancel")
    common.apply = { type: "boolean" };
  if (command === "cancel") common["initialized-at"] = { type: "string" };

  let parsed;
  try {
    parsed = parseArgs({ args: options, options: common, tokens: true });
  } catch {
    fail("Invalid options. Use --help for the command syntax.");
  }
  if (
    new Set(parsed.tokens.map(({ name }) => name)).size !== parsed.tokens.length
  )
    fail("Each option may appear only once.");

  const values = parsed.values;
  if (!values["evidence-dir"] || !isAbsolute(values["evidence-dir"]))
    fail("Provide an absolute path in --evidence-dir.");
  const payment = {
    paymentId: values["payment-id"],
    orderId: values["order-id"],
    reference: values.reference,
  };
  if (
    command !== "report" &&
    (!paymentIdPattern.test(payment.paymentId ?? "") ||
      !validOrderId(payment.orderId) ||
      !referencePattern.test(payment.reference ?? ""))
  )
    fail(
      "Provide the sandbox payment ID, allocated order ID, and reference UUID from one session.",
    );
  const initializedAt = utcTime(values["initialized-at"]);
  if (command === "cancel" && !Number.isFinite(initializedAt))
    fail("Provide the session creation time in UTC using --initialized-at.");
  return { command, payment, initializedAt, values };
}

function inside(parent, path) {
  const location = relative(parent, path);
  return (
    location !== ".." && !location.startsWith("../") && !isAbsolute(location)
  );
}

async function syncDirectory(path) {
  const directory = await open(path, "r");
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}

async function evidenceDirectory(path, writes) {
  const repo = await realpath(fileURLToPath(new URL("../", import.meta.url)));
  const parent = await realpath(join(path, ".."));
  if (inside(repo, parent))
    fail("Keep the evidence directory outside the repository.");

  try {
    await mkdir(path, { mode: 0o700 });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  const info = await lstat(path);
  if (
    !info.isDirectory() ||
    info.uid !== process.getuid() ||
    (info.mode & 0o077) !== 0
  )
    fail("Use an evidence directory owned by your user with permissions 700.");
  const dir = await realpath(path);
  if (inside(repo, dir))
    fail("Keep the evidence directory outside the repository.");
  if (writes) await syncDirectory(parent);
  return dir;
}

function evidencePath(dir, orderId, kind) {
  return join(dir, orderId + "." + kind + ".json");
}

async function save(dir, orderId, kind, record) {
  const temporary = join(dir, "." + randomUUID());
  const file = await open(temporary, "wx", 0o600);
  try {
    try {
      await file.writeFile(JSON.stringify(record) + "\n");
      await file.sync();
    } finally {
      await file.close();
    }
    try {
      await link(temporary, evidencePath(dir, orderId, kind));
    } catch (error) {
      if (error.code === "EEXIST") return false;
      throw error;
    }
    await syncDirectory(dir);
    return true;
  } finally {
    await unlink(temporary);
  }
}

async function read(dir, orderId, kind) {
  try {
    const path = evidencePath(dir, orderId, kind);
    const info = await lstat(path);
    if (
      !info.isFile() ||
      info.uid !== process.getuid() ||
      (info.mode & 0o077) !== 0 ||
      info.size > 4096
    )
      fail("Invalid local evidence file.");
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return undefined;
  }
}

function money(value) {
  if (typeof value === "string" && /^\d{1,2}(?:\.\d+)?$/.test(value))
    value = Number(value);
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= amount
    ? value
    : null;
}

function bank({ env, fetch }) {
  const Username = env.AMERIA_SANDBOX_USERNAME;
  const Password = env.AMERIA_SANDBOX_PASSWORD;
  if (!Username?.trim() || !Password?.trim())
    fail(
      "Load the Ameriabank sandbox username and password from private configuration.",
    );

  return async (method, paymentId, fields) => {
    try {
      const response = await fetch(sandbox + method, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          PaymentID: paymentId,
          Username,
          Password,
          ...fields,
        }),
      });
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        throw new Error();
      }
      const chunks = [];
      let size = 0;
      const reader = response.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 32_768) {
            await reader.cancel();
            throw new Error();
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!result || typeof result !== "object" || Array.isArray(result))
        throw new Error();
      return result;
    } catch {
      fail("Ameriabank sandbox request failed.");
    }
  };
}

function digits(value) {
  if (typeof value === "string") return value;
  return Number.isSafeInteger(value) ? String(value) : "";
}

async function bankDetails(post, payment) {
  const data = await post("GetPaymentDetails", payment.paymentId);
  const status = digits(data.OrderStatus);
  if (
    data.ResponseCode !== "00" ||
    digits(data.OrderID) !== payment.orderId ||
    data.Opaque !== payment.reference ||
    money(data.Amount) !== amount ||
    data.Currency !== currency ||
    !/^[0-6]$/.test(status) ||
    data.PaymentState !== states[Number(status)]
  )
    fail("Bank details did not match the expected sandbox payment.");
  return {
    bankStatus: status,
    bankState: states[Number(status)],
    depositedAmount: money(data.DepositedAmount),
    approvedAmount: money(data.ApprovedAmount),
    refundedAmount: money(data.RefundedAmount),
  };
}

function deposited(details) {
  return details.bankStatus === "2" && details.depositedAmount === amount;
}

function eligible(command, details, initializedAt, now) {
  if (command === "refund") {
    if (!deposited(details) || details.refundedAmount !== 0)
      fail(
        "A full refund requires a verified AMD 10 deposit with zero prior refunds.",
      );
  } else {
    if (
      details.bankStatus !== "1" ||
      details.approvedAmount !== amount ||
      details.depositedAmount !== 0 ||
      details.refundedAmount !== 0
    )
      fail("Cancellation requires a fresh preauthorized AMD 10 payment.");
    if (now < initializedAt || now - initializedAt >= 72 * 60 * 60 * 1000)
      fail(
        "Cancellation requires a session initialized within the past 72 hours.",
      );
  }
}

function matchesOutcome(operation, details) {
  return operation === "refund"
    ? details.bankStatus === "4" && details.refundedAmount === amount
    : details.bankStatus === "3" &&
        details.depositedAmount === 0 &&
        details.refundedAmount === 0;
}

function baseRecord(payment, now) {
  return {
    ...payment,
    amount,
    currency,
    timestamp: new Date(now()).toISOString(),
  };
}

function safeRecord(record, orderId) {
  if (
    !record ||
    record.orderId !== orderId ||
    typeof record.paymentId !== "string" ||
    !paymentIdPattern.test(record.paymentId) ||
    typeof record.reference !== "string" ||
    !referencePattern.test(record.reference) ||
    !Number.isFinite(utcTime(record.timestamp))
  )
    fail("Invalid local evidence record.");
  return {
    orderId,
    paymentId: record.paymentId,
    reference: record.reference,
    amount,
    currency,
    timestamp: record.timestamp,
  };
}

function safeDetails(record) {
  if (
    !record ||
    typeof record.bankStatus !== "string" ||
    !/^[0-6]$/.test(record.bankStatus)
  )
    fail("Invalid local evidence status.");
  return {
    bankStatus: record.bankStatus,
    bankState: states[Number(record.bankStatus)],
    depositedAmount: money(record.depositedAmount),
    approvedAmount: money(record.approvedAmount),
    refundedAmount: money(record.refundedAmount),
  };
}

async function result(dir, orderId, claim) {
  const base = safeRecord(claim, orderId);
  if (!Object.hasOwn(operations, claim.operation))
    fail("Invalid local evidence operation.");
  const [response, verified] = await Promise.all([
    read(dir, base.orderId, "response"),
    read(dir, base.orderId, "outcome"),
  ]);
  const bankResponseCode =
    typeof response?.code === "string" && /^\d{2,6}$/.test(response.code)
      ? response.code
      : null;
  const outcome = verified ? safeDetails(verified) : null;
  if (
    outcome &&
    (!matchesOutcome(claim.operation, outcome) ||
      !Number.isFinite(utcTime(verified.timestamp)))
  )
    fail("Invalid local evidence outcome.");
  return {
    ...base,
    operation: claim.operation,
    before: safeDetails(claim.before),
    bankResponseCode,
    status: outcome
      ? bankResponseCode === "00"
        ? "VERIFIED"
        : "OBSERVED"
      : "UNCONFIRMED",
    outcome: outcome ? { ...outcome, timestamp: verified.timestamp } : null,
  };
}

async function report(dir) {
  const counts = { payments: 0, refunds: 0, cancellations: 0 };
  const payments = [];
  const operations = [];
  for (const name of (await readdir(dir)).sort()) {
    const match = /^(\d{8})\.(payment|attempt)\.json$/.exec(name);
    if (!match || !validOrderId(match[1])) continue;
    const [, orderId, kind] = match;
    const record = await read(dir, orderId, kind);
    if (kind === "payment") {
      const details = safeDetails(record);
      if (!deposited(details)) fail("Invalid local evidence payment.");
      payments.push({ ...safeRecord(record, orderId), ...details });
      counts.payments++;
    } else {
      const operation = await result(dir, orderId, record);
      operations.push(operation);
      if (operation.status === "VERIFIED")
        counts[
          operation.operation === "refund" ? "refunds" : "cancellations"
        ]++;
    }
  }
  return {
    mode: "AMERIA_SANDBOX",
    protocol: "REST",
    counts,
    payments,
    operations,
  };
}

export async function run(
  args,
  { env = process.env, fetch = globalThis.fetch, now = Date.now } = {},
) {
  const { command, payment, initializedAt, values } = parseCommand(args);
  const writes = values.apply || values.record || command === "verify";
  const dir = await evidenceDirectory(values["evidence-dir"], writes);
  if (command === "report") return report(dir);

  const { orderId } = payment;
  const post = bank({ env, fetch });
  if (command === "verify") {
    const claim = await read(dir, orderId, "attempt");
    if (
      !claim ||
      claim.paymentId !== payment.paymentId ||
      claim.orderId !== orderId ||
      claim.reference !== payment.reference ||
      !Object.hasOwn(operations, claim.operation)
    )
      fail("No matching local attempt to verify.");
    const details = await bankDetails(post, payment);
    if (matchesOutcome(claim.operation, details))
      await save(dir, orderId, "outcome", {
        ...details,
        timestamp: new Date(now()).toISOString(),
      });
    return { ...(await result(dir, orderId, claim)), current: details };
  }

  if (values.apply && (await read(dir, orderId, "attempt")))
    fail("An operation was already attempted for this order. Use verify.");

  const details = await bankDetails(post, payment);
  const evidence = { ...baseRecord(payment, now), ...details };
  if (command === "inspect") {
    if (values.record) {
      if (!deposited(details))
        fail("Payment evidence requires a verified AMD 10 deposit.");
      await save(dir, orderId, "payment", evidence);
    }
    return evidence;
  }

  eligible(command, details, initializedAt, now());
  if (!values.apply)
    return { ...evidence, operation: command, status: "ELIGIBLE" };

  if (command === "refund") await save(dir, orderId, "payment", evidence);
  const claim = {
    ...baseRecord(payment, now),
    operation: command,
    before: details,
  };
  if (!(await save(dir, orderId, "attempt", claim)))
    fail("An operation was already attempted for this order. Use verify.");

  try {
    const response = await post(
      operations[command],
      payment.paymentId,
      command === "refund" ? { Amount: amount } : undefined,
    );
    if (
      typeof response.ResponseCode === "string" &&
      /^\d{2,6}$/.test(response.ResponseCode)
    )
      await save(dir, orderId, "response", { code: response.ResponseCode });
    if (response.ResponseCode !== "00")
      fail("The bank did not acknowledge the operation.");
    const outcome = await bankDetails(post, payment);
    if (!matchesOutcome(command, outcome))
      fail("The bank has not confirmed the final state.");
    await save(dir, orderId, "outcome", {
      ...outcome,
      timestamp: new Date(now()).toISOString(),
    });
    return await result(dir, orderId, claim);
  } catch {
    fail(
      "The operation remains unconfirmed. Use verify before taking further action.",
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = process.argv.slice(2);
  if (!args.length || args[0] === "--help") {
    process.stdout.write(help);
  } else {
    try {
      process.stdout.write(JSON.stringify(await run(args), null, 2) + "\n");
    } catch (error) {
      process.stderr.write(
        (error instanceof CliError
          ? error.message
          : "Could not access sandbox operations evidence.") + "\n",
      );
      process.exitCode = 1;
    }
  }
}

import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { run } from "../ameria-sandbox-operations.mjs";

const orderId = "30543001";
const paymentId = "synthetic-payment-id";
const reference = "1b8c0d08-cd78-4c7f-a64c-dce5c9fe6e72";
const now = Date.parse("2026-11-06T12:00:00Z");
const sandbox = "https://servicestest.ameriabank.am/VPOS/api/VPOS/";

function details(overrides = {}) {
  return {
    OrderID: orderId,
    Opaque: reference,
    Amount: 10,
    Currency: "051",
    DepositedAmount: 10,
    ApprovedAmount: 10,
    RefundedAmount: 0,
    OrderStatus: "2",
    PaymentState: "payment_deposited",
    ResponseCode: "00",
    CardNumber: "fixture-pan-marker",
    ClientEmail: "fixture-contact-marker",
    ...overrides,
  };
}

function refunded() {
  return details({
    OrderStatus: "4",
    PaymentState: "payment_refunded",
    RefundedAmount: 10,
  });
}

function approved() {
  return details({
    OrderStatus: "1",
    PaymentState: "payment_approved",
    DepositedAmount: 0,
  });
}

async function fixture(t, responses) {
  const dir = await mkdtemp(join(await realpath(tmpdir()), "athlon-ops-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const calls = [];
  const options = {
    now: () => now,
    env: {
      AMERIA_SANDBOX_USERNAME: "fixture-user",
      AMERIA_SANDBOX_PASSWORD: "fixture-password",
    },
    async fetch(url, init) {
      assert.equal(init.method, "POST");
      assert.equal(init.redirect, "error");
      assert.ok(init.signal);
      assert.ok(url.startsWith(sandbox));
      calls.push({
        endpoint: url.slice(sandbox.length),
        body: JSON.parse(init.body),
      });
      const result = responses.shift();
      assert.ok(result, "Unexpected request");
      if (result instanceof Error) throw result;
      return result instanceof Response ? result : Response.json(result);
    },
  };
  return {
    dir,
    calls,
    call(command, ...extra) {
      const args = [command, "--evidence-dir", dir];
      if (command !== "report")
        args.push(
          "--payment-id",
          paymentId,
          "--order-id",
          orderId,
          "--reference",
          reference,
        );
      return run([...args, ...extra], options);
    },
  };
}

test("refund preview performs one details check and leaves evidence empty", async (t) => {
  const { call, calls, dir } = await fixture(t, [details()]);
  assert.equal((await call("refund")).status, "ELIGIBLE");
  assert.deepEqual(
    calls.map(({ endpoint }) => endpoint),
    ["GetPaymentDetails"],
  );
  assert.deepEqual(await readdir(dir), []);
});

test("full refund records the verified payment and refund using sanitized private evidence", async (t) => {
  const { call, calls, dir } = await fixture(t, [
    details(),
    { ResponseCode: "00", ResponseMessage: "fixture-bank-message" },
    refunded(),
  ]);
  assert.equal((await call("refund", "--apply")).status, "VERIFIED");
  assert.deepEqual(
    calls.map(({ endpoint }) => endpoint),
    ["GetPaymentDetails", "RefundPayment", "GetPaymentDetails"],
  );
  assert.deepEqual(calls[1].body, {
    PaymentID: paymentId,
    Username: "fixture-user",
    Password: "fixture-password",
    Amount: 10,
  });
  const report = await call("report");
  assert.deepEqual(report.counts, {
    payments: 1,
    refunds: 1,
    cancellations: 0,
  });
  assert.equal(report.operations[0].orderId, orderId);
  assert.equal(report.operations[0].bankResponseCode, "00");
  for (const name of await readdir(dir)) {
    assert.equal((await stat(join(dir, name))).mode & 0o777, 0o600);
    assert.doesNotMatch(
      await readFile(join(dir, name), "utf8"),
      /fixture-(pan|contact|bank|user|password)/,
    );
  }
});

test("inspect only records an explicitly requested verified deposit", async (t) => {
  const { call } = await fixture(t, [details(), details()]);
  await call("inspect");
  assert.equal((await call("report")).counts.payments, 0);
  await call("inspect", "--record");
  assert.equal((await call("report")).counts.payments, 1);
});

test("cancellation only accepts a fresh preauthorization and sends no amount", async (t) => {
  const { call, calls } = await fixture(t, [
    details(),
    approved(),
    approved(),
    { ResponseCode: "00" },
    details({
      OrderStatus: "3",
      PaymentState: "payment_void",
      DepositedAmount: 0,
    }),
  ]);
  await assert.rejects(
    call("cancel", "--apply", "--initialized-at", "2026-11-06T11:00:00Z"),
    /preauthorized/i,
  );
  await assert.rejects(
    call("cancel", "--apply", "--initialized-at", "2026-11-03T12:00:00Z"),
    /72 hours/i,
  );
  const result = await call(
    "cancel",
    "--apply",
    "--initialized-at",
    "2026-11-06T11:00:00Z",
  );
  assert.equal(result.status, "VERIFIED");
  const mutation = calls.find(({ endpoint }) => endpoint === "CancelPayment");
  assert.ok(mutation);
  assert.equal(Object.hasOwn(mutation.body, "Amount"), false);
  assert.equal((await call("report")).counts.cancellations, 1);
});

test("a changed order, amount, currency, reference or status prevents mutation", async (t) => {
  const cases = [
    { OrderID: "30543002" },
    { Amount: 100 },
    { Currency: "840" },
    { Opaque: "unrelated-reference" },
    { PaymentState: "payment_approved" },
    { RefundedAmount: 3 },
  ];
  const { call, calls } = await fixture(t, cases.map(details));
  for (const _ of cases) await assert.rejects(call("refund", "--apply"));
  assert.equal(calls.length, cases.length);
  assert.ok(calls.every(({ endpoint }) => endpoint === "GetPaymentDetails"));
});

test("a lost mutation response blocks retry and records only an observed outcome", async (t) => {
  const { call, calls } = await fixture(t, [
    details(),
    new Error("fixture-password"),
    refunded(),
  ]);
  await assert.rejects(
    call("refund", "--apply"),
    (error) =>
      /verify/i.test(error.message) &&
      !error.message.includes("fixture-password"),
  );
  assert.equal((await call("report")).operations[0].status, "UNCONFIRMED");
  await assert.rejects(call("refund", "--apply"), /already|verify/i);
  assert.equal((await call("verify")).status, "OBSERVED");
  const report = await call("report");
  assert.equal(report.operations[0].status, "OBSERVED");
  assert.equal(report.counts.refunds, 0);
  assert.equal(
    calls.filter(({ endpoint }) => endpoint === "RefundPayment").length,
    1,
  );
});

test("an acknowledged but unconfirmed refund can be verified later", async (t) => {
  const { call, calls } = await fixture(t, [
    details(),
    { ResponseCode: "00" },
    details(),
    refunded(),
  ]);
  await assert.rejects(call("refund", "--apply"), /verify/i);
  assert.equal((await call("report")).counts.refunds, 0);
  assert.equal((await call("verify")).status, "VERIFIED");
  assert.equal((await call("report")).counts.refunds, 1);
  assert.equal(
    calls.filter(({ endpoint }) => endpoint === "RefundPayment").length,
    1,
  );
});

test("two overlapping applies send at most one mutation", async (t) => {
  const { call, calls } = await fixture(t, [
    details(),
    details(),
    { ResponseCode: "00" },
    refunded(),
  ]);
  const outcomes = await Promise.allSettled([
    call("refund", "--apply"),
    call("refund", "--apply"),
  ]);
  assert.equal(
    outcomes.filter(({ status }) => status === "fulfilled").length,
    1,
  );
  assert.equal(
    calls.filter(({ endpoint }) => endpoint === "RefundPayment").length,
    1,
  );
  assert.equal((await call("report")).counts.refunds, 1);
});

test("a body above the limit cannot authorize a write", async (t) => {
  const { call, calls } = await fixture(t, [
    Response.json(details({ Description: "x".repeat(33_000) })),
  ]);
  await assert.rejects(call("refund", "--apply"), /request failed/i);
  assert.equal(calls.length, 1);
});

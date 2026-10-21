const storageKey = "athlon_sandbox_request_v1";
interface SandboxRequest {
  key: string;
  fingerprint: string;
  reference?: string;
}

function read(storage: Storage): SandboxRequest | null {
  const raw = storage.getItem(storageKey);
  if (raw === null) return null;
  const record = JSON.parse(raw) as Partial<SandboxRequest> | null;
  if (
    !record ||
    typeof record.key !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      record.key,
    ) ||
    typeof record.fingerprint !== "string" ||
    (record.reference !== undefined &&
      (typeof record.reference !== "string" || !record.reference.trim()))
  ) {
    throw new Error("Invalid sandbox request record");
  }
  return record as SandboxRequest;
}

export function retainSandboxRequestKey(input: unknown): string {
  // No access code, bank credential or customer data is stored.
  const fingerprint = JSON.stringify(input);
  const storage = window.sessionStorage;
  const current = read(storage);
  if (current?.fingerprint === fingerprint) return current.key;
  const key = globalThis.crypto.randomUUID();
  const next = JSON.stringify({ key, fingerprint });
  storage.setItem(storageKey, next);
  if (storage.getItem(storageKey) !== next)
    throw new Error("Sandbox request was not retained");
  return key;
}

export function bindSandboxRequest(key: string, reference: string): void {
  const storage = window.sessionStorage;
  const current = read(storage);
  if (
    !reference?.trim() ||
    !current ||
    current.key !== key ||
    (current.reference !== undefined && current.reference !== reference)
  ) {
    throw new Error("Sandbox request does not match session");
  }
  const next = JSON.stringify({ ...current, reference });
  storage.setItem(storageKey, next);
  if (storage.getItem(storageKey) !== next)
    throw new Error("Sandbox session was not retained");
}

export function retireSandboxRequest(reference: string): boolean {
  try {
    const storage = window.sessionStorage;
    const current = read(storage);
    if (!current) return true;
    // An unbound legacy/uncertain attempt cannot safely be attributed to a receipt.
    if (!current.reference) return false;
    if (current.reference !== reference) return true;
    storage.removeItem(storageKey);
    return storage.getItem(storageKey) === null;
  } catch {
    return false;
  }
}

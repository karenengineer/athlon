import { mkdtemp, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupOwnedResources } from "./isolated-cleanup";

describe("owned integration resource teardown", () => {
  it("removes the exact temporary directory despite earlier shutdown failures and reports all causes", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "athlon-cleanup-regression-"),
    );
    const appError = new Error("app shutdown failed");
    const containerError = new Error("owned container stop failed");
    const events: string[] = [];
    try {
      const failure = await cleanupOwnedResources([
        {
          label: "app",
          cleanup: () => {
            events.push("app");
            return Promise.reject(appError);
          },
        },
        {
          label: "container athlon-owned-test",
          cleanup: () => {
            events.push("container");
            return Promise.reject(containerError);
          },
        },
        {
          label: `uploads ${directory}`,
          cleanup: async () => {
            events.push("uploads");
            await rm(directory, { recursive: true });
          },
        },
      ]).catch((error: unknown) => error);
      expect(events).toEqual(["app", "container", "uploads"]);
      await expect(access(directory)).rejects.toMatchObject({ code: "ENOENT" });
      expect(failure).toBeInstanceOf(AggregateError);
      const errors = (failure as AggregateError).errors as Error[];
      expect(errors.map((error) => error.message)).toEqual([
        "Failed cleanup: app",
        "Failed cleanup: container athlon-owned-test",
      ]);
      expect(errors.map((error) => error.cause)).toEqual([
        appError,
        containerError,
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("finishes successful cleanup without inventing a failure", async () => {
    await expect(
      cleanupOwnedResources([
        { label: "owned", cleanup: () => Promise.resolve(undefined) },
      ]),
    ).resolves.toBeUndefined();
  });
});

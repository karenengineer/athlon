export async function cleanupOwnedResources(
  resources: { label: string; cleanup: () => Promise<unknown> }[],
): Promise<void> {
  const errors: Error[] = [];
  for (const resource of resources) {
    try {
      await resource.cleanup();
    } catch (cause) {
      errors.push(new Error(`Failed cleanup: ${resource.label}`, { cause }));
    }
  }
  if (errors.length)
    throw new AggregateError(errors, "Owned resource cleanup failed");
}

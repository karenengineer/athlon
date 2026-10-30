import { DestroyRef, inject } from "@angular/core";
import { Meta, Title } from "@angular/platform-browser";

const BASELINE_ATTRIBUTE = "data-athlon-description-baseline";

export interface PageMetadata {
  title: string;
  description: string;
}

export function createPageMetadata(): {
  set(metadata: PageMetadata): void;
  clear(): void;
} {
  const meta = inject(Meta);
  const title = inject(Title);
  let ownedDescription: HTMLMetaElement | null = null;
  let ownedTitle: string | undefined;
  let baselineDescription: string | null = null;

  const clear = (): void => {
    if (
      ownedDescription &&
      meta.getTag('name="description"') === ownedDescription
    ) {
      meta.removeTagElement(ownedDescription);
      if (baselineDescription !== null) {
        meta.addTag({ name: "description", content: baselineDescription });
      }
      if (title.getTitle() === ownedTitle) title.setTitle("ATHLON");
    }
    ownedDescription = null;
    ownedTitle = undefined;
  };

  inject(DestroyRef).onDestroy(clear);
  return {
    set(metadata): void {
      const previous = meta.getTag('name="description"');
      const inherited = previous?.getAttribute(BASELINE_ATTRIBUTE);
      baselineDescription =
        inherited == null
          ? (previous?.content ?? null)
          : inherited.startsWith("text:")
            ? inherited.slice(5)
            : null;
      // A fresh element identifies this handle's ownership without shared state.
      // The baseline attribute survives SSR hydration and overlapping handles.
      meta.removeTag('name="description"');
      ownedDescription = meta.addTag(
        {
          name: "description",
          content: metadata.description,
          [BASELINE_ATTRIBUTE]:
            baselineDescription === null
              ? "none"
              : `text:${baselineDescription}`,
        },
        true,
      );
      ownedTitle = metadata.title;
      title.setTitle(metadata.title);
    },
    clear,
  };
}

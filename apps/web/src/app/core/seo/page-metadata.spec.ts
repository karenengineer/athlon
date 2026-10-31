import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Meta, Title } from "@angular/platform-browser";
import { createPageMetadata, publicImageUrl } from "./page-metadata";

@Component({ template: "" })
class MetadataPage {
  readonly metadata = createPageMetadata();
}

describe("Page metadata ownership", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MetadataPage] });
    TestBed.inject(Meta).removeTag('name="description"');
  });

  it("omits empty and unsafe public image URLs", () => {
    expect(publicImageUrl("")).toBeUndefined();
    expect(publicImageUrl("  ")).toBeUndefined();
    expect(publicImageUrl("javascript:alert(1)")).toBeUndefined();
    expect(publicImageUrl("/brand/athlon-hero-wide.jpeg")).toBe(
      "https://athlon.am/brand/athlon-hero-wide.jpeg",
    );
  });

  it("restores the initial description when leaving a page", () => {
    TestBed.inject(Meta).addTag({
      name: "description",
      content: "Original store description",
    });
    const fixture = TestBed.createComponent(MetadataPage);
    fixture.componentInstance.metadata.set({
      title: "Protein | ATHLON",
      description: "Compare protein packages.",
    });
    fixture.destroy();
    expect(TestBed.inject(Meta).getTag('name="description"')?.content).toBe(
      "Original store description",
    );
  });

  it("replaces all SEO tags across handles and escapes inert structured data", () => {
    const previous = TestBed.createComponent(MetadataPage);
    previous.componentInstance.metadata.set({
      title: "Product",
      description: "Actual description",
      locale: "en",
      path: ["product", "whey"],
      jsonLd: [
        { "@type": "Product", name: "</script><script>alert(1)</script>&" },
      ],
    });
    expect(
      document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
    ).toBe("https://athlon.am/en/product/whey");
    expect(
      Array.from(document.querySelectorAll('link[rel="alternate"]')).map(
        (node) => node.getAttribute("hreflang"),
      ),
    ).toEqual(["hy", "ru", "en"]);
    const script = document.querySelector('script[type="application/ld+json"]');
    expect(script?.textContent).not.toContain("<");
    expect(JSON.parse(script!.textContent!).name).toContain("</script>");
    const current = TestBed.createComponent(MetadataPage);
    current.componentInstance.metadata.set({
      title: "Search",
      description: "Search",
      locale: "ru",
      path: ["search"],
      query: { q: "whey" },
      noindex: true,
    });
    previous.destroy();
    expect(
      document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
    ).toBe("https://athlon.am/ru/search?q=whey");
    expect(document.querySelectorAll('link[rel="alternate"]')).toHaveLength(0);
    expect(
      document.querySelectorAll('script[type="application/ld+json"]'),
    ).toHaveLength(0);
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe(
      "noindex, follow",
    );
    current.destroy();
    expect(document.querySelectorAll("[data-athlon-seo]")).toHaveLength(0);
  });

  it("inherits the initial description across overlapping page handles", () => {
    TestBed.inject(Meta).addTag({
      name: "description",
      content: "Original store description",
    });
    const previous = TestBed.createComponent(MetadataPage);
    previous.componentInstance.metadata.set({
      title: "Protein | ATHLON",
      description: "Compare protein packages.",
    });
    const current = TestBed.createComponent(MetadataPage);
    current.componentInstance.metadata.set({
      title: "Contact | ATHLON",
      description: "Contact the store.",
    });
    previous.destroy();
    expect(TestBed.inject(Meta).getTag('name="description"')?.content).toBe(
      "Contact the store.",
    );
    current.destroy();
    expect(TestBed.inject(Meta).getTag('name="description"')?.content).toBe(
      "Original store description",
    );
  });

  it("adopts server-rendered ownership without duplicates or restoring stale page copy", () => {
    const meta = TestBed.inject(Meta);
    meta.addTag({
      name: "description",
      content: "Server product",
      "data-athlon-seo": "",
      "data-athlon-description-baseline": "text:Original store description",
    });
    const canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    canonical.setAttribute("href", "https://athlon.am/en/product/old");
    canonical.setAttribute("data-athlon-seo", "");
    document.head.appendChild(canonical);
    const fixture = TestBed.createComponent(MetadataPage);
    fixture.componentInstance.metadata.set({
      title: "Client product",
      description: "Client copy",
      locale: "hy",
      path: ["product", "new"],
    });
    expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(
      document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
    ).toBe("https://athlon.am/hy/product/new");
    fixture.destroy();
    expect(meta.getTag('name="description"')?.content).toBe(
      "Original store description",
    );
  });

  it("sets document metadata and clears its owned values on component destruction", () => {
    const fixture = TestBed.createComponent(MetadataPage);
    fixture.componentInstance.metadata.set({
      title: "Protein | ATHLON",
      description: "Compare protein packages.",
    });
    expect(TestBed.inject(Title).getTitle()).toBe("Protein | ATHLON");
    expect(TestBed.inject(Meta).getTag('name="description"')?.content).toBe(
      "Compare protein packages.",
    );
    fixture.destroy();
    expect(TestBed.inject(Meta).getTag('name="description"')).toBeNull();
    expect(TestBed.inject(Title).getTitle()).toBe("ATHLON");
  });

  it("does not clear a newer page's metadata even when its text is identical", () => {
    const previous = TestBed.createComponent(MetadataPage);
    const current = TestBed.createComponent(MetadataPage);
    previous.componentInstance.metadata.set({
      title: "Catalog | ATHLON",
      description: "Browse the catalog.",
    });
    current.componentInstance.metadata.set({
      title: "Catalog | ATHLON",
      description: "Browse the catalog.",
    });
    previous.componentInstance.metadata.clear();
    previous.destroy();
    expect(TestBed.inject(Title).getTitle()).toBe("Catalog | ATHLON");
    expect(TestBed.inject(Meta).getTag('name="description"')?.content).toBe(
      "Browse the catalog.",
    );
    expect(TestBed.inject(Meta).getTags('name="description"')).toHaveLength(1);
  });

  it("preserves the next route's independently set title while removing the old description", () => {
    const fixture = TestBed.createComponent(MetadataPage);
    fixture.componentInstance.metadata.set({
      title: "Protein | ATHLON",
      description: "Compare protein packages.",
    });
    TestBed.inject(Title).setTitle("Home | ATHLON");
    fixture.destroy();
    expect(TestBed.inject(Title).getTitle()).toBe("Home | ATHLON");
    expect(TestBed.inject(Meta).getTag('name="description"')).toBeNull();
  });
});

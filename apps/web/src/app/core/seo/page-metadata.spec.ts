import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Meta, Title } from "@angular/platform-browser";
import { createPageMetadata } from "./page-metadata";

@Component({ template: "" })
class MetadataPage {
  readonly metadata = createPageMetadata();
}

describe("Page metadata ownership", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MetadataPage] });
    TestBed.inject(Meta).removeTag('name="description"');
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

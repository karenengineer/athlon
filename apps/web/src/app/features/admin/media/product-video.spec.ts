import { SimpleChange } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { of, throwError } from "rxjs";
import { ProductVideo, PendingProductVideo } from "./product-video";
import { AdminCatalogService } from "../shared/admin-catalog.service";

const savedVideo = {
  url: "/video.mp4",
  mobileUrl: "/mobile.mp4",
  mimeType: "video/mp4" as const,
  durationSeconds: 3,
  sizeBytes: 1000,
  mobileSizeBytes: 300,
};

describe("admin product video", () => {
  const api = {
    uploadVideo: vi.fn(() => of(savedVideo)),
    deleteVideo: vi.fn(() => of(undefined)),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.uploadVideo.mockReturnValue(of(savedVideo));
    api.deleteVideo.mockReturnValue(of(undefined));
    vi.stubGlobal(
      "URL",
      class extends URL {
        static override createObjectURL = vi.fn(() => "blob:local-preview");
        static override revokeObjectURL = vi.fn();
      },
    );
    TestBed.configureTestingModule({
      imports: [ProductVideo],
      providers: [{ provide: AdminCatalogService, useValue: api }],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  function manager(id: string | null = null) {
    const fixture = TestBed.createComponent(ProductVideo);
    fixture.componentRef.setInput("productId", id);
    fixture.detectChanges();
    return fixture;
  }

  function choose(
    component: ProductVideo,
    file = new File(["test"], "preview.mp4", { type: "video/mp4" }),
  ) {
    component.chooseFile({
      target: { files: [file], value: "" },
    } as unknown as Event);
    component.metadata({ target: { duration: 3 } } as unknown as Event);
    return file;
  }

  it("preserves a selected file across product creation and waits for the cover", () => {
    const create = manager();
    const file = choose(create.componentInstance);
    expect(create.componentInstance.hasUnsavedChanges()).toBe(true);
    create.componentInstance.preserveForCreatedProduct("created-product");
    expect(create.componentInstance.hasUnsavedChanges()).toBe(false);
    create.destroy();
    const edit = manager("created-product");
    expect(edit.componentInstance.file()).toBe(file);
    edit.componentInstance.metadata({
      target: { duration: 3 },
    } as unknown as Event);
    edit.componentInstance.upload();
    expect(api.uploadVideo).not.toHaveBeenCalled();
    edit.componentRef.setInput("coverUrl", "/cover.webp");
    edit.detectChanges();
    const changed = vi.fn();
    edit.componentInstance.videoChange.subscribe(changed);
    edit.componentInstance.upload();
    expect(api.uploadVideo).toHaveBeenCalledWith("created-product", file);
    expect(changed).toHaveBeenCalledWith(savedVideo);
    expect(edit.componentInstance.hasUnsavedChanges()).toBe(false);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:local-preview");
    expect(
      TestBed.inject(PendingProductVideo).take("created-product"),
    ).toBeNull();
  });

  it("rejects unsupported, oversized, and longer-than-15-second videos", () => {
    const fixture = manager("id");
    const component = fixture.componentInstance;
    choose(component, new File(["x"], "script.mp4", { type: "text/html" }));
    expect(component.file()).toBeNull();
    const oversized = new File(["x"], "large.mp4", { type: "video/mp4" });
    Object.defineProperty(oversized, "size", { value: 20 * 1024 * 1024 + 1 });
    choose(component, oversized);
    expect(component.file()).toBeNull();
    choose(component);
    component.metadata({ target: { duration: 15.01 } } as unknown as Event);
    expect(component.durationValid()).toBe(false);
    expect(component.error()).toBe("videoValidation");
    component.upload();
    expect(api.uploadVideo).not.toHaveBeenCalled();
  });

  it("keeps the selected file for retry after an upload failure", () => {
    api.uploadVideo.mockReturnValue(throwError(() => ({ status: 503 })));
    const fixture = manager("id");
    fixture.componentRef.setInput("coverUrl", "/cover.webp");
    fixture.detectChanges();
    const file = choose(fixture.componentInstance);
    fixture.componentInstance.upload();
    expect(fixture.componentInstance.file()).toBe(file);
    expect(fixture.componentInstance.busy()).toBe(false);
    expect(fixture.componentInstance.error()).toBe("videoUploadError");
  });

  it("requires confirmation to remove a persisted video and does not clear it on failure", () => {
    const fixture = manager("id");
    const component = fixture.componentInstance;
    const changed = vi.fn();
    component.videoChange.subscribe(changed);
    component.remove(false);
    expect(api.deleteVideo).not.toHaveBeenCalled();
    api.deleteVideo.mockReturnValue(throwError(() => new Error("offline")));
    component.remove(true);
    expect(changed).not.toHaveBeenCalled();
    expect(component.error()).toBe("videoRemoveError");
    api.deleteVideo.mockReturnValue(of(undefined));
    component.remove(true);
    expect(changed).toHaveBeenCalledWith(null);
  });

  it("does not reuse a pending file for another product", () => {
    TestBed.inject(PendingProductVideo).save(
      "first",
      new File(["x"], "preview.mp4"),
    );
    const fixture = manager("second");
    expect(fixture.componentInstance.file()).toBeNull();
    fixture.componentInstance.ngOnChanges({
      productId: new SimpleChange("second", "third", false),
    });
    expect(fixture.componentInstance.file()).toBeNull();
  });
});

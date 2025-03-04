import { CacheManager, MemoryCacheAdapter, FsCacheAdapter, DbCacheAdapter } from "../src/cache";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs/promises";
import path from "path";

vi.mock("fs/promises");

describe("CacheManager", () => {
    let cache: CacheManager<MemoryCacheAdapter>;

    beforeEach(() => {
        vi.useFakeTimers();
        cache = new CacheManager(new MemoryCacheAdapter());
        vi.setSystemTime(Date.now());
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should set/get/delete cache", async () => {
        await cache.set("foo", "bar");
        expect(await cache.get("foo")).toEqual("bar");
        await cache.delete("foo");
        expect(await cache.get("foo")).toEqual(undefined);
    });

    it("should handle expiring cache", async () => {
        const expires = Date.now() + 1000;
        await cache.set("foo", "bar", { expires });
        expect(await cache.get("foo")).toEqual("bar");
        expect(cache.adapter.data.get("foo")).toEqual(
            JSON.stringify({ value: "bar", expires: expires })
        );
        vi.setSystemTime(expires + 1000);
        expect(await cache.get("foo")).toEqual(undefined);
        expect(cache.adapter.data.get("foo")).toEqual(undefined);
    });
});

describe("MemoryCacheAdapter", () => {
    let adapter: MemoryCacheAdapter;

    beforeEach(() => {
        adapter = new MemoryCacheAdapter();
    });

    it("should set/get/delete data", async () => {
        await adapter.set("key", "value");
        expect(await adapter.get("key")).toBe("value");
        await adapter.delete("key");
        expect(await adapter.get("key")).toBeUndefined();
    });

    it("should initialize with provided data", () => {
        const initialData = new Map([["key", "value"]]);
        adapter = new MemoryCacheAdapter(initialData);
        expect(adapter.data).toBe(initialData);
    });
});

describe("FsCacheAdapter", () => {
    const dataDir = "/test/cache";
    let adapter: FsCacheAdapter;

    beforeEach(() => {
        vi.mocked(fs.readFile).mockReset();
        vi.mocked(fs.writeFile).mockReset();
        vi.mocked(fs.mkdir).mockReset();
        vi.mocked(fs.unlink).mockReset();
        adapter = new FsCacheAdapter(dataDir);
    });

    it("should get data from file", async () => {
        vi.mocked(fs.readFile).mockResolvedValue("test data");
        const result = await adapter.get("test.txt");
        expect(result).toBe("test data");
        expect(fs.readFile).toHaveBeenCalledWith(path.join(dataDir, "test.txt"), "utf8");
    });

    it("should return undefined when file not found", async () => {
        vi.mocked(fs.readFile).mockRejectedValue(new Error());
        const result = await adapter.get("nonexistent.txt");
        expect(result).toBeUndefined();
    });

    it("should write data to file", async () => {
        await adapter.set("test.txt", "test data");
        expect(fs.mkdir).toHaveBeenCalledWith(path.dirname(path.join(dataDir, "test.txt")), { recursive: true });
        expect(fs.writeFile).toHaveBeenCalledWith(path.join(dataDir, "test.txt"), "test data", "utf8");
    });

    it("should delete file", async () => {
        await adapter.delete("test.txt");
        expect(fs.unlink).toHaveBeenCalledWith(path.join(dataDir, "test.txt"));
    });
});

describe("DbCacheAdapter", () => {
    const mockDb = {
        getCache: vi.fn(),
        setCache: vi.fn(),
        deleteCache: vi.fn()
    };
    const agentId = "test-agent-id";
    let adapter: DbCacheAdapter;

    beforeEach(() => {
        mockDb.getCache.mockReset();
        mockDb.setCache.mockReset();
        mockDb.deleteCache.mockReset();
        adapter = new DbCacheAdapter(mockDb, agentId);
    });

    it("should get data from database", async () => {
        mockDb.getCache.mockResolvedValue("test data");
        const result = await adapter.get("test-key");
        expect(result).toBe("test data");
        expect(mockDb.getCache).toHaveBeenCalledWith({ agentId, key: "test-key" });
    });

    it("should set data in database", async () => {
        await adapter.set("test-key", "test data");
        expect(mockDb.setCache).toHaveBeenCalledWith({ agentId, key: "test-key", value: "test data" });
    });

    it("should delete data from database", async () => {
        await adapter.delete("test-key");
        expect(mockDb.deleteCache).toHaveBeenCalledWith({ agentId, key: "test-key" });
    });
});

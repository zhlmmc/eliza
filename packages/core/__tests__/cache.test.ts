import { CacheManager, MemoryCacheAdapter, FsCacheAdapter, DbCacheAdapter } from "../src/cache.ts";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs/promises";
import path from "path";
import type { IDatabaseCacheAdapter, UUID } from "../src/types";

vi.mock("fs/promises");
const mockedFs = vi.mocked(fs);

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

    it("should handle non-expiring cache", async () => {
        await cache.set("foo", "bar", { expires: 0 });
        expect(await cache.get("foo")).toEqual("bar");
        vi.setSystemTime(Date.now() + 1000000);
        expect(await cache.get("foo")).toEqual("bar");
    });
});

describe("MemoryCacheAdapter", () => {
    let adapter: MemoryCacheAdapter;

    beforeEach(() => {
        adapter = new MemoryCacheAdapter();
    });

    it("should initialize with empty map if no initial data provided", () => {
        expect(adapter.data.size).toBe(0);
    });

    it("should initialize with provided initial data", () => {
        const initialData = new Map([["key", "value"]]);
        adapter = new MemoryCacheAdapter(initialData);
        expect(adapter.data.get("key")).toBe("value");
    });

    it("should set and get values", async () => {
        await adapter.set("key", "value");
        expect(await adapter.get("key")).toBe("value");
    });

    it("should delete values", async () => {
        await adapter.set("key", "value");
        await adapter.delete("key");
        expect(await adapter.get("key")).toBeUndefined();
    });
});

describe("FsCacheAdapter", () => {
    let adapter: FsCacheAdapter;
    const testDir = "/test/cache";

    beforeEach(() => {
        vi.resetAllMocks();
        adapter = new FsCacheAdapter(testDir);
    });

    it("should get existing file content", async () => {
        mockedFs.readFile.mockResolvedValue("cached data");
        const result = await adapter.get("test.txt");
        expect(result).toBe("cached data");
        expect(mockedFs.readFile).toHaveBeenCalledWith(
            path.join(testDir, "test.txt"),
            "utf8"
        );
    });

    it("should handle non-existing file", async () => {
        mockedFs.readFile.mockRejectedValue(new Error("File not found"));
        const result = await adapter.get("nonexistent.txt");
        expect(result).toBeUndefined();
    });

    it("should write file content", async () => {
        await adapter.set("test.txt", "new data");
        expect(mockedFs.mkdir).toHaveBeenCalled();
        expect(mockedFs.writeFile).toHaveBeenCalledWith(
            path.join(testDir, "test.txt"),
            "new data",
            "utf8"
        );
    });

    it("should delete file", async () => {
        await adapter.delete("test.txt");
        expect(mockedFs.unlink).toHaveBeenCalledWith(
            path.join(testDir, "test.txt")
        );
    });
});

describe("DbCacheAdapter", () => {
    const mockDb: IDatabaseCacheAdapter = {
        getCache: vi.fn(),
        setCache: vi.fn(),
        deleteCache: vi.fn(),
    };
    const testAgentId: UUID = "test-agent-id" as UUID;
    let adapter: DbCacheAdapter;

    beforeEach(() => {
        vi.resetAllMocks();
        adapter = new DbCacheAdapter(mockDb, testAgentId);
    });

    it("should get cache from database", async () => {
        mockDb.getCache.mockResolvedValue("cached value");
        const result = await adapter.get("test-key");
        expect(result).toBe("cached value");
        expect(mockDb.getCache).toHaveBeenCalledWith({
            agentId: testAgentId,
            key: "test-key",
        });
    });

    it("should set cache in database", async () => {
        await adapter.set("test-key", "test-value");
        expect(mockDb.setCache).toHaveBeenCalledWith({
            agentId: testAgentId,
            key: "test-key",
            value: "test-value",
        });
    });

    it("should delete cache from database", async () => {
        await adapter.delete("test-key");
        expect(mockDb.deleteCache).toHaveBeenCalledWith({
            agentId: testAgentId,
            key: "test-key",
        });
    });
});

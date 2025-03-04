import { vi, describe, it, expect, beforeEach } from "vitest";
import { LocalEmbeddingModelManager } from "../src/localembeddingManager";
import { FlagEmbedding, EmbeddingModel } from "fastembed";

// Mock FlagEmbedding
vi.mock("fastembed", () => ({
    FlagEmbedding: {
        init: vi.fn(),
    },
    EmbeddingModel: {
        BGESmallENV15: "BGE-Small-EN-v1.5",
    },
}));

// Mock fs module
vi.mock("node:fs", () => ({
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    default: {
        existsSync: vi.fn(),
        mkdirSync: vi.fn(),
    },
}));

const mockFs = vi.mocked(await import("node:fs"));

describe("LocalEmbeddingModelManager", () => {
    let manager: LocalEmbeddingModelManager;

    beforeEach(() => {
        LocalEmbeddingModelManager.resetInstance();
        manager = LocalEmbeddingModelManager.getInstance();
        vi.clearAllMocks();

        // Setup default mock implementations
        mockFs.existsSync.mockReturnValue(true);
        mockFs.mkdirSync.mockReturnValue(undefined);
        (FlagEmbedding.init as vi.Mock).mockClear();
    });

    describe("getInstance", () => {
        it("should return singleton instance", () => {
            const instance1 = LocalEmbeddingModelManager.getInstance();
            const instance2 = LocalEmbeddingModelManager.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe("initialize", () => {
        it("should initialize model successfully", async () => {
            const mockModel = {
                queryEmbed: vi.fn().mockResolvedValue(new Float32Array(384)),
            };
            (FlagEmbedding.init as vi.Mock).mockResolvedValue(mockModel);

            await manager.initialize();

            expect(FlagEmbedding.init).toHaveBeenCalledWith({
                cacheDir: expect.any(String),
                model: EmbeddingModel.BGESmallENV15,
                maxLength: 512,
            });
        });

        it("should create cache directory if it doesn't exist", async () => {
            mockFs.existsSync.mockReturnValue(false);
            const mockModel = {
                queryEmbed: vi.fn().mockResolvedValue(new Float32Array(384)),
            };
            (FlagEmbedding.init as vi.Mock).mockResolvedValue(mockModel);

            await manager.initialize();

            expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
        });

        it("should not initialize multiple times", async () => {
            const mockModel = {
                queryEmbed: vi.fn().mockResolvedValue(new Float32Array(384)),
            };
            (FlagEmbedding.init as vi.Mock).mockResolvedValue(mockModel);

            await Promise.all([
                manager.initialize(),
                manager.initialize(),
                manager.initialize(),
            ]);

            expect(FlagEmbedding.init).toHaveBeenCalledTimes(1);
        });

        it("should handle initialization errors", async () => {
            (FlagEmbedding.init as vi.Mock).mockRejectedValue(new Error("Init failed"));

            await expect(manager.initialize()).rejects.toThrow("Init failed");
        });
    });

    describe("generateEmbedding", () => {
        it("should generate embedding successfully", async () => {
            const mockEmbedding = new Float32Array(384).fill(0.1);
            const mockModel = {
                queryEmbed: vi.fn().mockResolvedValue(mockEmbedding),
            };
            (FlagEmbedding.init as vi.Mock).mockResolvedValue(mockModel);

            await manager.initialize();
            const result = await manager.generateEmbedding("test input");

            expect(result).toHaveLength(384);
            expect(result).toEqual(Array.from(mockEmbedding));
        });

        it("should handle different embedding formats", async () => {
            const mockEmbedding = [new Float32Array(384).fill(0.1)];
            const mockModel = {
                queryEmbed: vi.fn().mockResolvedValue(mockEmbedding),
            };
            (FlagEmbedding.init as vi.Mock).mockResolvedValue(mockModel);

            await manager.initialize();
            const result = await manager.generateEmbedding("test input");

            expect(result).toHaveLength(384);
            expect(result).toEqual(Array.from(mockEmbedding[0]));
        });

        it("should handle regular array embedding format", async () => {
            const mockEmbedding = Array(384).fill(0.1);
            const mockModel = {
                queryEmbed: vi.fn().mockResolvedValue(mockEmbedding),
            };
            (FlagEmbedding.init as vi.Mock).mockResolvedValue(mockModel);

            await manager.initialize();
            const result = await manager.generateEmbedding("test input");

            expect(result).toHaveLength(384);
            expect(result).toEqual(mockEmbedding);
        });

        it("should handle embedding generation errors", async () => {
            const mockModel = {
                queryEmbed: vi.fn().mockRejectedValue(new Error("Generation failed")),
            };
            (FlagEmbedding.init as vi.Mock).mockResolvedValue(mockModel);

            await manager.initialize();
            await expect(manager.generateEmbedding("test input")).rejects.toThrow("Generation failed");
        });

        it("should throw error for invalid embedding format", async () => {
            const mockModel = {
                queryEmbed: vi.fn().mockResolvedValue("invalid format"),
            };
            (FlagEmbedding.init as vi.Mock).mockResolvedValue(mockModel);

            await manager.initialize();
            await expect(manager.generateEmbedding("test input")).rejects.toThrow("Unexpected embedding format");
        });
    });

    describe("reset", () => {
        it("should reset manager state", async () => {
            const mockModel = {
                queryEmbed: vi.fn().mockResolvedValue(new Float32Array(384)),
            };
            (FlagEmbedding.init as vi.Mock).mockResolvedValue(mockModel);

            await manager.initialize();
            await manager.reset();

            // Should re-initialize after reset
            await manager.generateEmbedding("test");
            expect(FlagEmbedding.init).toHaveBeenCalledTimes(2);
        });
    });

    describe("resetInstance", () => {
        it("should reset singleton instance", () => {
            const instance1 = LocalEmbeddingModelManager.getInstance();
            LocalEmbeddingModelManager.resetInstance();
            const instance2 = LocalEmbeddingModelManager.getInstance();

            expect(instance1).not.toBe(instance2);
        });
    });
});

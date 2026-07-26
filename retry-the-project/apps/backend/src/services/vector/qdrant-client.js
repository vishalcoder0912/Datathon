import { QdrantClient } from "@qdrant/js-client-rest";
import { vectorDbConfig } from "../../config/vector-db.js";

let client = null;
const ensuredCollections = new Map();

function qdrantStatus(error) {
  if (!error) return undefined;
  if (error.status) return error.status;
  if (error.response?.status) return error.response.status;
  if (typeof error.getActualType === "function") {
    try {
      return error.getActualType()?.status;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function getQdrantClient() {
  if (client) return client;

  client = new QdrantClient({
    url: vectorDbConfig.qdrant.url,
    apiKey: vectorDbConfig.qdrant.apiKey,
  });

  return client;
}

export async function ensureQdrantCollection(collectionName, vectorSize) {
  if (!collectionName) throw new Error("Qdrant collection name is required.");
  if (!Number.isFinite(Number(vectorSize)) || Number(vectorSize) <= 0) {
    throw new Error("A positive vector size is required to create a Qdrant collection.");
  }

  const cacheKey = `${collectionName}:${vectorSize}`;
  if (ensuredCollections.get(cacheKey)) return { collectionName, vectorSize, created: false };

  const qdrant = getQdrantClient();

  try {
    await qdrant.getCollection(collectionName);
  } catch (error) {
    const status = qdrantStatus(error);
    if (status && status !== 404) throw error;
    if (!status && !/not found|doesn't exist|404/i.test(String(error?.message || ""))) throw error;

    await qdrant.createCollection(collectionName, {
      vectors: {
        size: Number(vectorSize),
        distance: "Cosine",
      },
    });
  }

  ensuredCollections.set(cacheKey, true);

  return { collectionName, vectorSize: Number(vectorSize), created: true };
}

export async function getQdrantCollectionInfo(collectionName) {
  return getQdrantClient().getCollection(collectionName);
}

export default {
  getQdrantClient,
  ensureQdrantCollection,
  getQdrantCollectionInfo,
};

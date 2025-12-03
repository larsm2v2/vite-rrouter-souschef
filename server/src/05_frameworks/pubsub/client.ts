import { PubSub, Topic } from "@google-cloud/pubsub";

const projectId = process.env.GCP_PROJECT_ID || "souschef4me";
let pubsub: PubSub | null = null;

let ocrTopic: Topic | null = null;

async function getOcrTopic(): Promise<Topic> {
  if (!ocrTopic) {
    const topicName = process.env.OCR_JOBS_TOPIC || "ocr-jobs";
    if (!pubsub) {
      try {
        pubsub = new PubSub({ projectId });
      } catch (err) {
        console.error("Failed to create Pub/Sub client:", err);
        throw err;
      }
    }

    ocrTopic = pubsub.topic(topicName);

    try {
      const [exists] = await ocrTopic.exists();
      if (!exists) {
        console.warn(
          `Pub/Sub topic "${topicName}" does not exist. Creating it...`
        );
        await pubsub.createTopic(topicName);
        console.log(`Created Pub/Sub topic: ${topicName}`);
      }
    } catch (err) {
      console.error(`Failed to check/create Pub/Sub topic:`, err);
      throw new Error(
        `Pub/Sub topic "${topicName}" setup failed. Ensure GCP credentials are configured.`
      );
    }
  }
  return ocrTopic;
}

export interface OcrJobMessage {
  jobId: string;
  userId?: number;
  filePaths: string[];
  ocrText?: string;
  timestamp: number;
}

export async function publishOcrJob(
  jobData: Omit<OcrJobMessage, "timestamp">
): Promise<string> {
  try {
    const topic = await getOcrTopic();
    const message: OcrJobMessage = {
      ...jobData,
      timestamp: Date.now(),
    };

    const messageId = await topic.publishMessage({
      json: message,
    });

    console.log(
      JSON.stringify({
        type: "pubsub-publish",
        topic: "ocr-jobs",
        jobId: jobData.jobId,
        messageId,
        timestamp: new Date().toISOString(),
      })
    );

    return messageId;
  } catch (error) {
    console.error(
      JSON.stringify({
        type: "pubsub-publish-error",
        jobId: jobData.jobId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      })
    );
    throw error;
  }
}

// Check if Pub/Sub is available (for environments without GCP)
export async function isPubSubAvailable(): Promise<boolean> {
  try {
    await getOcrTopic();
    return true;
  } catch (err) {
    console.warn("Pub/Sub not available, falling back to synchronous processing");
    return false;
  }
}

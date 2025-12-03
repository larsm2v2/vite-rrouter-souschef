"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishOcrJob = publishOcrJob;
exports.isPubSubAvailable = isPubSubAvailable;
const pubsub_1 = require("@google-cloud/pubsub");
const projectId = process.env.GCP_PROJECT_ID || "souschef4me";
let pubsub = null;
let ocrTopic = null;
function getOcrTopic() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!ocrTopic) {
            const topicName = process.env.OCR_JOBS_TOPIC || "ocr-jobs";
            if (!pubsub) {
                try {
                    pubsub = new pubsub_1.PubSub({ projectId });
                }
                catch (err) {
                    console.error("Failed to create Pub/Sub client:", err);
                    throw err;
                }
            }
            ocrTopic = pubsub.topic(topicName);
            try {
                const [exists] = yield ocrTopic.exists();
                if (!exists) {
                    console.warn(`Pub/Sub topic "${topicName}" does not exist. Creating it...`);
                    yield pubsub.createTopic(topicName);
                    console.log(`Created Pub/Sub topic: ${topicName}`);
                }
            }
            catch (err) {
                console.error(`Failed to check/create Pub/Sub topic:`, err);
                throw new Error(`Pub/Sub topic "${topicName}" setup failed. Ensure GCP credentials are configured.`);
            }
        }
        return ocrTopic;
    });
}
function publishOcrJob(jobData) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const topic = yield getOcrTopic();
            const message = Object.assign(Object.assign({}, jobData), { timestamp: Date.now() });
            const messageId = yield topic.publishMessage({
                json: message,
            });
            console.log(JSON.stringify({
                type: "pubsub-publish",
                topic: "ocr-jobs",
                jobId: jobData.jobId,
                messageId,
                timestamp: new Date().toISOString(),
            }));
            return messageId;
        }
        catch (error) {
            console.error(JSON.stringify({
                type: "pubsub-publish-error",
                jobId: jobData.jobId,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString(),
            }));
            throw error;
        }
    });
}
// Check if Pub/Sub is available (for environments without GCP)
function isPubSubAvailable() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield getOcrTopic();
            return true;
        }
        catch (err) {
            console.warn("Pub/Sub not available, falling back to synchronous processing");
            return false;
        }
    });
}

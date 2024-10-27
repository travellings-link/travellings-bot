import { MessageProcessor } from "../adapters/botAdapter";

export type Middleware = (next: MessageProcessor) => MessageProcessor;

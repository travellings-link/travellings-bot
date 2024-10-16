import { MessageProcessor } from "bot/adapters/botAdapter";

export type Middleware = (next: MessageProcessor) => MessageProcessor;

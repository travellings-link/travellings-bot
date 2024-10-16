import { MessageProcesser } from "bot/adapters/botAdapter";

export type Middleware = (next: MessageProcesser) => MessageProcesser;

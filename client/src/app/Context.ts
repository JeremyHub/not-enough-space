import { createContext } from "react";
import {
	Bit,
	Moon,
	DbConnection,
	Metadata,
	User,
	LeaderboardEntry,
} from "../module_bindings";
import { Identity } from "@clockworklabs/spacetimedb-sdk";
import z from "zod";
import { SettingsSchema } from "./Settings";

type ContextType = {
	conn: DbConnection;
	identity: Identity;
	self: User;
	users: Map<string, User>;
	bits: Map<number, Bit>;
	moons: Map<number, Moon>;
	leaderboardEntries: Map<Identity, LeaderboardEntry>;
	metadata: Metadata;
	viewportWorldWidth: number;
	viewportWorldHeight: number;
	renderBuffer: number;
	settings: z.infer<typeof SettingsSchema>;
};

export const Context = createContext<ContextType | undefined>(undefined);
export type { ContextType };

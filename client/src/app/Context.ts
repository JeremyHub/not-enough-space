import { createContext } from "react";
import {
	Bit,
	Moon,
	DbConnection,
	User,
	LeaderboardEntry,
	StaticMetadata,
	DynamicMetadata,
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
	leaderboardEntries: Map<string, LeaderboardEntry>;
	staticMetadata: StaticMetadata;
	dynamicMetadata: DynamicMetadata;
	viewportWorldWidth: number;
	viewportWorldHeight: number;
	renderBuffer: number;
	settings: z.infer<typeof SettingsSchema>;
	removingBits: Map<number, { bit: Bit; start: number }>;
};

export const Context = createContext<ContextType | undefined>(undefined);
export type { ContextType };

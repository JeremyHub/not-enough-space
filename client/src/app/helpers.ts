import z from "zod";
import { SettingsSchema } from "./Settings";

export function getDefaultSettings(): z.infer<typeof SettingsSchema> {
	return {
		auto_reconnect_on_death: true,
	};
}

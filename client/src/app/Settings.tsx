import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect } from "react";

import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";

// eslint-disable-next-line react-refresh/only-export-components
export function getDefaultSettings(): z.infer<typeof SettingsSchema> {
	return {
		auto_reconnect_on_death: true,
		show_world_boundaries: false,
		clear_local_storage_on_refresh: true,
	};
}

export const SettingsSchema = z.object({
	auto_reconnect_on_death: z.boolean(),
	show_world_boundaries: z.boolean(),
	clear_local_storage_on_refresh: z.boolean(),
});

export function Settings({
	setSettings,
}: {
	setSettings: (settings: z.infer<typeof SettingsSchema>) => void;
}) {
	const form = useForm<z.infer<typeof SettingsSchema>>({
		resolver: zodResolver(SettingsSchema),
		defaultValues: getDefaultSettings(),
	});

	useEffect(() => {
		const subscription = form.watch((values) => {
			setSettings(values as z.infer<typeof SettingsSchema>);
		});
		return () => subscription.unsubscribe();
	}, [form, setSettings]);

	return (
		<Card className="border-4 border-zinc-800 bg-zinc-900 shadow-lg w-full h-full flex flex-col p-5 bg-zinc-950">
			<CardContent className="p-0 flex-1 flex flex-col overflow-auto">
				<Form {...form}>
					<form className="w-full space-y-6">
						<div>
							<h3 className="mb-6 text-lg font-medium text-primary-foreground">
								Settings
							</h3>
							<div className="space-y-4">
								<FormField
									control={form.control}
									name="auto_reconnect_on_death"
									render={({ field }) => (
										<FormItem className="bg-zinc-900 flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
											<div className="space-y-1">
												<FormLabel className="text-primary-foreground">
													Auto-reconnect On Death
												</FormLabel>
												<FormDescription>
													Enable automatic reconnection to the server with the
													same name & color if your character dies.
												</FormDescription>
											</div>
											<FormControl>
												<Switch
													checked={field.value}
													onCheckedChange={field.onChange}
												/>
											</FormControl>
										</FormItem>
									)}
								/>
								<FormItem className="bg-zinc-900 flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
									<Accordion type="single" collapsible className="w-full">
										<AccordionItem value="advanced-settings">
											<AccordionTrigger className="text-primary-foreground p-1">
												Advanced Settings
											</AccordionTrigger>
											<AccordionContent className="p-0 space-y-3">
												<FormField
													control={form.control}
													name="show_world_boundaries"
													render={({ field }) => (
														<FormItem className="bg-zinc-900 flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mt-2">
															<div className="space-y-1">
																<FormLabel className="text-primary-foreground">
																	Show World Boundaries
																</FormLabel>
																<FormDescription>
																	Display the world boundaries overlay in-game.
																</FormDescription>
															</div>
															<FormControl>
																<Switch
																	checked={field.value}
																	onCheckedChange={field.onChange}
																/>
															</FormControl>
														</FormItem>
													)}
												/>
												<FormField
													control={form.control}
													name="clear_local_storage_on_refresh"
													render={({ field }) => (
														<FormItem className="bg-zinc-900 flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mt-2">
															<div className="space-y-1">
																<FormLabel className="text-primary-foreground">
																	Save User Settings
																</FormLabel>
																<FormDescription>
																	Turn off if you want to connect as a different
																	user each time you reload the game.
																</FormDescription>
															</div>
															<FormControl>
																<Switch
																	checked={field.value}
																	onCheckedChange={field.onChange}
																/>
															</FormControl>
														</FormItem>
													)}
												/>
											</AccordionContent>
										</AccordionItem>
									</Accordion>
								</FormItem>
							</div>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
}

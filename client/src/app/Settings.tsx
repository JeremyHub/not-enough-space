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
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
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
		lerp_strength: 0.15,
		show_world_boundaries: false,
		upscaling_quality: 2.5,
	};
}

export const SettingsSchema = z.object({
	auto_reconnect_on_death: z.boolean(),
	lerp_strength: z.number().min(0).max(1),
	show_world_boundaries: z.boolean(),
	upscaling_quality: z.number(),
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
								<FormField
									control={form.control}
									name="lerp_strength"
									render={({ field }) => (
										<FormItem className="bg-zinc-900 flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
											<div className="space-y-1">
												<FormLabel className="text-primary-foreground">
													Lag Compensation Strength
												</FormLabel>
												<FormDescription>
													High values make for smoother movement but may
													introduce more input lag.
												</FormDescription>
											</div>
											<FormControl>
												<div className="flex flex-col items-end space-y-3">
													<Slider
														defaultValue={[1 - field.value]}
														min={0}
														max={0.99}
														step={0.01}
														value={[1 - field.value]}
														onValueChange={(value) => {
															field.onChange(1 - value[0]);
														}}
														className={"w-full mt-1"}
													/>
													<Button
														variant="outline"
														className="mt-2 text-muted-foreground hover:bg-zinc-800 border-muted-foreground bg-transparent"
														onClick={(e) => {
															e.preventDefault();
															field.onChange(0.2);
														}}
													>
														Reset to Default
													</Button>
												</div>
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
													name="upscaling_quality"
													render={({ field }) => (
														<FormItem className="bg-zinc-900 flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
															<div className="space-y-1">
																<FormLabel className="text-primary-foreground">
																	Dynamic Upscaling Quality
																</FormLabel>
																<FormDescription>
																	High values result in more detail but might
																	have negative performance effects.
																</FormDescription>
															</div>
															<FormControl>
																<div className="flex flex-col items-end space-y-3">
																	<Slider
																		defaultValue={[field.value]}
																		min={1}
																		max={3}
																		step={0.1}
																		value={[field.value]}
																		onValueChange={(value) => {
																			field.onChange(value[0]);
																		}}
																		className={"w-full mt-1"}
																	/>
																	<Button
																		variant="outline"
																		className="mt-2 text-muted-foreground hover:bg-zinc-800 border-muted-foreground bg-transparent"
																		onClick={(e) => {
																			e.preventDefault();
																			field.onChange(2.5);
																		}}
																	>
																		Reset to Default
																	</Button>
																</div>
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

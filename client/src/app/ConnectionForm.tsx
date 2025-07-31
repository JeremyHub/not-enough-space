import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { randBetween } from "big-integer";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ColorPicker } from "@/components/ui/color-picker";

function isColorTooWhiteOrBlack(hex: string) {
	const clean = hex.replace("#", "");
	const r = parseInt(clean.substring(0, 2), 16);
	const g = parseInt(clean.substring(2, 4), 16);
	const b = parseInt(clean.substring(4, 6), 16);
	const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
	return brightness < 50 || brightness > 200;
}

function getRandomColor() {
	let color;
	do {
		const hex = Math.floor(Math.random() * 0xffffff)
			.toString(16)
			.padStart(6, "0");
		color = `#${hex}`;
	} while (isColorTooWhiteOrBlack(color));
	return color;
}

export const ConnectionFormSchema = z.object({
	username: z
		.string()
		.min(2, {
			message: "Username must be at least 2 characters.",
		})
		.max(32, {
			message: "Username must be at most 32 characters.",
		})
		.regex(/^[a-zA-Z0-9_]+$/, {
			message: "Username can only contain letters, numbers, and underscores.",
		}),
	color: z
		.string()
		.regex(/^#([0-9A-Fa-f]{3}){1,2}$/, {
			message: "Color must be a valid hex code.",
		})
		.refine((val) => !isColorTooWhiteOrBlack(val), {
			message: "Color is too white or too black. Please pick another.",
		}),
	uri: z.string().url({
		message: "Invalid URI format.",
	}),
	seed: z
		.bigint()
		.min(BigInt(0), {
			message: "Seed must be a non-negative integer.",
		})
		.max(BigInt("18446744073709551615"), {
			message: "Seed must be at most 18446744073709551615.",
		}),
	recconnect: z.boolean(),
});

export function ConnectionForm({
	onSubmit,
	setConnectionForm,
}: {
	onSubmit: (
		data: Omit<z.infer<typeof ConnectionFormSchema>, "username"> & {
			username: string;
		},
	) => void;
	setConnectionForm: (
		data: Omit<z.infer<typeof ConnectionFormSchema>, "username"> & {
			username: string;
		},
	) => void;
}) {
	const hasAuthToken =
		typeof window !== "undefined" && !!localStorage.getItem("auth_token");

	const form = useForm<
		Omit<z.infer<typeof ConnectionFormSchema>, "username"> & {
			username: string;
		}
	>({
		resolver: zodResolver(ConnectionFormSchema),
		defaultValues: {
			username:
				typeof import.meta !== "undefined" &&
				import.meta.env &&
				import.meta.env.MODE === "development"
					? "test"
					: "",
			color: getRandomColor(),
			uri:
				typeof import.meta !== "undefined" &&
				import.meta.env &&
				import.meta.env.MODE === "development"
					? "ws://localhost:3000"
					: "https://maincloud.spacetimedb.com",
			seed: BigInt(Number(randBetween(0, 18446744073709551615n))),
			recconnect: true,
		},
	});

	useEffect(() => {
		setConnectionForm(form.getValues());
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		const subscription = form.watch((values) => {
			setConnectionForm(values as z.infer<typeof ConnectionFormSchema>);
		});
		return () => subscription.unsubscribe();
	}, [form, setConnectionForm]);

	const handleConnectAsNewUser = () => {
		form.setValue("recconnect", false);
		form.handleSubmit(onSubmit)();
	};

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(onSubmit)}
				className="w-1/2 space-y-6 z-1"
			>
				<FormField
					control={form.control}
					name="username"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Username</FormLabel>
							<FormControl>
								<Input
									placeholder="my-username"
									{...field}
									value={field.value ?? ""}
									className="selection:bg-blue-200"
								/>
							</FormControl>
							<FormDescription>Your public display name.</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="color"
					render={() => (
						<FormItem>
							<FormLabel>Color</FormLabel>
							<FormControl>
								<ColorPicker
									value={form.watch("color")}
									onChange={(value) => {
										if (typeof value === "string") {
											form.setValue("color", value);
										}
									}}
								/>
							</FormControl>
							<FormDescription>
								The color of your character. Click to change it.
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="seed"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Seed</FormLabel>
							<FormControl>
								<div className="flex flex-row space-x-2 items-center">
									<Input
										className="flex-1 selection:bg-blue-200"
										value={field.value.toString()}
										onChange={(e) => {
											const val = e.target.value;
											if (!/^\d*$/.test(val)) {
												return;
											}
											field.onChange(val === "" ? BigInt(0) : BigInt(val));
										}}
										onBlur={field.onBlur}
										name={field.name}
										ref={field.ref}
									/>
									<Button
										type="button"
										variant="outline"
										className="flex-1 text-xs text-white border-white bg-transparent"
										onClick={() => {
											const newSeed = BigInt(
												Number(randBetween(0, 18446744073709551615n)),
											);
											field.onChange(newSeed);
										}}
									>
										Randomize Seed
									</Button>
								</div>
							</FormControl>
							<FormDescription>
								The seed that controls how your character looks.
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="uri"
					render={({ field }) => (
						<FormItem>
							<FormLabel>SpacetimeDB URI</FormLabel>
							<FormControl>
								<Input {...field} className="selection:bg-blue-200" />
							</FormControl>
							<FormDescription>
								The WebSocket URI for the SpacetimeDB instance. Leave as default
								unless you are trying to connect ot a custom server.
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>
				<Button type="submit" variant="outline" className="text-black w-full">
					{hasAuthToken ? "Reconnect" : "Connect"}
				</Button>
				{hasAuthToken && (
					<Button
						type="button"
						variant="ghost"
						className="w-full text-xs bg-transparent"
						onClick={handleConnectAsNewUser}
					>
						Connect as new user
					</Button>
				)}
			</form>
		</Form>
	);
}

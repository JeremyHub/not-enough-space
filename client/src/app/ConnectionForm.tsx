import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
});

export function ConnectionForm({
  onSubmit,
}: {
  onSubmit: (data: z.infer<typeof ConnectionFormSchema>) => void;
}) {
  const form = useForm<z.infer<typeof ConnectionFormSchema>>({
    resolver: zodResolver(ConnectionFormSchema),
    defaultValues: {
      username: "test",
      color: getRandomColor(),
      uri: "ws://localhost:3000",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-2/3 space-y-6">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="shadcn" {...field} />
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
          name="uri"
          render={({ field }) => (
            <FormItem>
              <FormLabel>SpacetimeDB URI</FormLabel>
              <FormControl>
                <Input placeholder="ws://localhost:3000" {...field} />
              </FormControl>
              <FormDescription>
                The WebSocket URI for your SpacetimeDB instance.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" variant="outline" className="text-black">
          Connect
        </Button>
      </form>
    </Form>
  );
}

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

export const ConnectionFormSchema = z.object({
  username: z.string().min(2, {
    message: "Username must be at least 2 characters.",
  }),
  uri: z.string().url({
    message: "Invalid URI format.",
  }),
})

export function ConnectionForm(
    { onSubmit }: { onSubmit: (data: z.infer<typeof ConnectionFormSchema>) => void }
) {
  const form = useForm<z.infer<typeof ConnectionFormSchema>>({
    resolver: zodResolver(ConnectionFormSchema),
    defaultValues: {
      username: "test",
      uri: "ws://localhost:3000",
    },
  })

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
              <FormDescription>
                This is your public display name.
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
        <Button type="submit">Connect</Button>
      </form>
    </Form>
  )
}

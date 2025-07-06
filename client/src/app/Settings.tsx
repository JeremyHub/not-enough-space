import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useEffect } from "react"

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"

export const SettingsSchema = z.object({
  auto_reconnect: z.boolean(),
})

export function Settings({ setSettings }: {
  setSettings: (settings: z.infer<typeof SettingsSchema>) => void
}) {
  const form = useForm<z.infer<typeof SettingsSchema>>({
    resolver: zodResolver(SettingsSchema),
    defaultValues: {
      auto_reconnect: true,
    },
  })

  useEffect(() => {
    const subscription = form.watch((values) => {
      setSettings(values as z.infer<typeof SettingsSchema>)
    })
    return () => subscription.unsubscribe()
  }, [form, setSettings])

  return (
    <Card className="border-4 border-zinc-800 bg-zinc-900 shadow-lg w-full h-full flex flex-col p-5 bg-zinc-950">
      <CardContent className="p-0 flex-1 flex flex-col overflow-auto">
        <Form {...form}>
        <form className="w-full space-y-6">
            <div>
            <h3 className="mb-6 text-lg font-medium text-primary-foreground">Settings</h3>
            <div className="space-y-4">
                <FormField
                control={form.control}
                name="auto_reconnect"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                        <FormLabel className="text-primary-foreground">Auto-reconnect</FormLabel>
                        <FormDescription>
                        Enable automatic reconnection to the server if the connection is lost.
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
            </div>
            </div>
        </form>
        </Form>
        </CardContent>
      </Card>
  )
}

"use client";

import { useActionState } from "react";
import { Alert, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/form-state";
import { sendOpsSmsAction } from "../actions";

const INITIAL = { ok: false } as const;

/**
 * One number, one message, and whatever the gateway said back.
 *
 * No recipient picker and no template list on purpose. This is the manual
 * escape hatch and the only way to prove from outside the server that the SMS
 * gateway is configured and the sender name approved; anything that sends to
 * more than one person at a time is a different tool with different rules.
 */
export function SendSmsForm({ defaultPhone }: { defaultPhone?: string }) {
  const [state, action] = useActionState(sendOpsSmsAction, INITIAL);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,18rem)_1fr]">
        <Field label="Number" htmlFor="ops-sms-phone" hint="Georgian mobile. 5XXXXXXXX or +995 5XX XX XX XX.">
          <Input
            id="ops-sms-phone"
            name="phone"
            type="tel"
            required
            defaultValue={defaultPhone}
            placeholder="+995 5XX XX XX XX"
            autoComplete="off"
          />
        </Field>
        <Field
          label="Message"
          htmlFor="ops-sms-body"
          hint="Georgian text is billed at 70 characters per part, Latin at 160."
        >
          <Textarea id="ops-sms-body" name="body" rows={3} required maxLength={480} />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton>Send</SubmitButton>
        {state.message && (
          <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>
        )}
      </div>
    </form>
  );
}

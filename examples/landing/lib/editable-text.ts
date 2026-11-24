import { createChange, definePrimitive, type ChangeDetails } from "@ui-sdk/core"

type EditableTextOptions = {
  defaultValue?: string
  onValueChange?: (value: string, details: ChangeDetails<"input-change" | "imperative">) => void
}

/**
 * Text that is edited where it stands, like the words on a page in the Torso editor.
 * The element's own text is what a person types into; `value` follows it, and a value set
 * from outside, by an agent for example, is written back into the element.
 */
const editableText = definePrimitive({
  name: "editable-text",
  options: { defaultValue: "string", onValueChange: "callback" },
  state: (options: EditableTextOptions) => ({ value: options.defaultValue ?? "" }),
  api: (context) => {
    const change = createChange(context)
    return {
      setValue: (value: string, event?: Event) =>
        event
          ? change("value", String(value), { reason: "input-change", event })
          : change("value", String(value), { reason: "imperative" }),
    }
  },
  agent: { actions: ["setValue"] },
  slots: (slot) => ({
    root: slot({
      role: "textbox",
      focus: "tab-stop",
      attrs: () => ({ tabindex: "0", contenteditable: "plaintext-only", spellcheck: "false" }),
      // React turns an `input` handler into onChange, which editable text never fires, so
      // the element is listened to directly.
      bind: (el, part) => {
        const typed = (event: Event) => part.api.setValue(el.textContent ?? "", event)
        el.addEventListener("input", typed)
        const unsubscribe = part.store.subscribe(() => {
          const { value } = part.store.get()
          if (el.textContent !== value) el.textContent = value
        })
        return () => {
          el.removeEventListener("input", typed)
          unsubscribe()
        }
      },
    }),
  }),
})

export { editableText }

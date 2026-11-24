"use client"

import { createParts } from "@ui-sdk/react/primitive"
import { editableText } from "@/lib/editable-text"

const { Root: EditableText } = createParts(editableText, { root: "span" })

export { EditableText }

/** Short pages of plain writing: about, contact, privacy, Impressum. Each is an MDX file. */
export default function ProseLayout({ children }: LayoutProps<"/">) {
  return <article className="mx-auto w-full max-w-2xl px-5 py-14 sm:px-8 sm:py-20">{children}</article>;
}

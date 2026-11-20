export function Art({ file, alt, className }: { file: string; alt: string; className?: string }) {
  if (!file) return null
  return <img className={className} alt={alt} src={asset(file)} draggable={false} />
}

export function asset(file: string) {
  const clean = file.replace(/^\/+/, "")
  const path = clean.startsWith("art/") ? clean : `art/${clean}`
  return `${import.meta.env.BASE_URL}${path}`
}

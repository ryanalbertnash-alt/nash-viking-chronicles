import fs from "node:fs"

const source = fs.readFileSync(new URL("../src/shared/app.ts", import.meta.url), "utf8")
const id = source.match(/export const BUNDLE_ID = "([^"]+)"/)?.[1]
if (!id) throw new Error("BUNDLE_ID is missing from src/shared/app.ts")
const project = new URL("../ios/App/App.xcodeproj/project.pbxproj", import.meta.url)
const text = fs.readFileSync(project, "utf8")
const next = text.replace(/PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g, `PRODUCT_BUNDLE_IDENTIFIER = ${id};`)
fs.writeFileSync(project, next)
console.log(`Bundle id is ${id}`)

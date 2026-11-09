export default {
	contexts: ["src/ordering"],
	entryFiles: ["index.ts", "contract/index.ts"],
	sourceRoots: ["src"],
	sharedKernel: "src/kernel",
	glossary: [{ term: "order", retire: ["Basket"] }],
}

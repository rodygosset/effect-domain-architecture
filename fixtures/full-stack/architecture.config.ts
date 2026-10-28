import model from "./domain-model.json" with { type: "json" }

export default {
	contexts: model.contexts.map((context) => context.module),
	entryFiles: ["index.ts", "contract/index.ts"],
	sourceRoots: [model.repo.frontend.path, "packages/*/src"],
	packageRoots: ["packages/*/src"],
	frontend: { root: model.repo.frontend.path },
	glossary: model.glossary.map((entry) => ({ term: entry.term, retire: entry.retire })),
}

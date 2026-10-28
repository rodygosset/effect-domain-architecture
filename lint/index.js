import { relativeFile } from "./files.js"
import { isVendored } from "./project.js"
import absence from "./rules/absence.js"
import booleanNames from "./rules/boolean-names.js"
import camelCaseLiteralUnions from "./rules/camel-case-literal-unions.js"
import conversionNames from "./rules/conversion-names.js"
import deniedNames from "./rules/denied-names.js"
import importBoundaries from "./rules/import-boundaries.js"
import messageVerbs from "./rules/message-verbs.js"
import noBannedNames from "./rules/no-banned-names.js"
import noBarrelSliceImport from "./rules/no-barrel-slice-import.js"
import noBlockBodiedArrows from "./rules/no-block-bodied-arrows.js"
import noClassInstanceFunctionProperty from "./rules/no-class-instance-function-property.js"
import noGlobalNamespaceNames from "./rules/no-global-namespace-names.js"
import noLeafReexports from "./rules/no-leaf-reexports.js"
import noModuleState from "./rules/no-module-state.js"
import noNamedFunctionExpressions from "./rules/no-named-function-expressions.js"
import noOfConstructors from "./rules/no-of-constructors.js"
import noSortMutation from "./rules/no-sort-mutation.js"
import noSwitchOnTag from "./rules/no-switch-on-tag.js"
import noTagChains from "./rules/no-tag-chains.js"
import noUnlistedVerbs from "./rules/no-unlisted-verbs.js"
import objectParamNames from "./rules/object-param-names.js"
import preferArrowForExpressionReturn from "./rules/prefer-arrow-for-expression-return.js"
import preferEffectFn from "./rules/prefer-effect-fn.js"
import preferNamedCallbacks from "./rules/prefer-named-callbacks.js"
import preferObjectMethodShorthand from "./rules/prefer-object-method-shorthand.js"
import preferPredicateOverTypeof from "./rules/prefer-predicate-over-typeof.js"
import schemaClassIdentifiers from "./rules/schema-class-identifiers.js"
import schemaToEquivalenceNoThis from "./rules/schema-to-equivalence-no-this.js"
import serviceModuleShape from "./rules/service-module-shape.js"
import spelledOutWords from "./rules/spelled-out-words.js"
import taggedUnionPascalCase from "./rules/tagged-union-pascal-case.js"

const rules = {
	absence,
	"boolean-names": booleanNames,
	"camel-case-literal-unions": camelCaseLiteralUnions,
	"conversion-names": conversionNames,
	"denied-names": deniedNames,
	"import-boundaries": importBoundaries,
	"message-verbs": messageVerbs,
	"no-banned-names": noBannedNames,
	"no-barrel-slice-import": noBarrelSliceImport,
	"no-block-bodied-arrows": noBlockBodiedArrows,
	"no-class-instance-function-property": noClassInstanceFunctionProperty,
	"no-global-namespace-names": noGlobalNamespaceNames,
	"no-leaf-reexports": noLeafReexports,
	"no-module-state": noModuleState,
	"no-named-function-expressions": noNamedFunctionExpressions,
	"no-of-constructors": noOfConstructors,
	"no-sort-mutation": noSortMutation,
	"no-switch-on-tag": noSwitchOnTag,
	"no-tag-chains": noTagChains,
	"no-unlisted-verbs": noUnlistedVerbs,
	"object-param-names": objectParamNames,
	"prefer-arrow-for-expression-return": preferArrowForExpressionReturn,
	"prefer-effect-fn": preferEffectFn,
	"prefer-named-callbacks": preferNamedCallbacks,
	"prefer-object-method-shorthand": preferObjectMethodShorthand,
	"prefer-predicate-over-typeof": preferPredicateOverTypeof,
	"schema-class-identifiers": schemaClassIdentifiers,
	"schema-to-equivalence-no-this": schemaToEquivalenceNoThis,
	"service-module-shape": serviceModuleShape,
	"spelled-out-words": spelledOutWords,
	"tagged-union-pascal-case": taggedUnionPascalCase,
}

/** Every rule skips the files `architecture.config.ts` lists as vendored, so no project repeats that list here. */
const skipVendored = (rule) => ({
	...rule,
	create: (context) => (isVendored(relativeFile(context)) ? {} : rule.create(context)),
})

export default {
	meta: { name: "effect-domain" },
	rules: Object.fromEntries(Object.entries(rules).map(([name, rule]) => [name, skipVendored(rule)])),
}
